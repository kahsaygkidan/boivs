package standard_contract.alfresco.service;

import lombok.NoArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import standard_contract.authentication.AuthController;
import standard_contract.exception.BadRequestAlertException;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@NoArgsConstructor
public class AlfrescoServiceImpl implements AlfrescoService {

    @Value("${spring.application.alfrescoBaseUrl}")
    private String alfrescoBaseUrl;

    @Value("${spring.application.alfrescoToken}")
    private String authToken;

    @Value("${spring.application.alfrescoFolderId:513e7015-d087-4370-8b05-fdd02340c0eb}")
    private String folderId;


    private static final Logger log = LoggerFactory.getLogger(AlfrescoServiceImpl.class);
    private static final String AUTH = "authorization";
    private static final String ENTITY_NAME = "ALFRESCO";

    private RestTemplate createSecureRestTemplate() throws NoSuchAlgorithmException, KeyManagementException {
        SSLContext sslContext = SSLContext.getInstance("TLSv1.2");
        sslContext.init(null, new TrustManager[]{
                new X509TrustManager() {
                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }

                    @Override
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {
                    }

                    @Override
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {
                    }
                }
        }, new SecureRandom());
        HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
        HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
        return new RestTemplate();
    }

    @Override
    public String uploadFileToAlfresco(MultipartFile file) throws NoSuchAlgorithmException, KeyManagementException {
        return uploadInternal(file.getResource(), file.getOriginalFilename());
    }

    @Override
    public String uploadByteToAlfresco(byte[] fileBytes, String fileName) throws NoSuchAlgorithmException, KeyManagementException {
        ByteArrayResource resource = new ByteArrayResource(fileBytes) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };
        return uploadInternal(resource, fileName);
    }

//    private String uploadInternal(Object resource, String fileName) throws NoSuchAlgorithmException, KeyManagementException {
//
//        String uploadUrl = alfrescoBaseUrl + folderId + "/children";
//        HttpHeaders headers = new HttpHeaders();
//        headers.set("Authorization", authToken);
//        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
//
//        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
//        body.add("filedata", resource);
//        body.add("name", fileName);
//        body.add("nodeType", "cm:content");
//
//        RestTemplate restTemplate = createSecureRestTemplate();
//        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
//
//        try {
//            ResponseEntity<Map> response = restTemplate.exchange(uploadUrl, HttpMethod.POST, requestEntity, Map.class);
//            log.info("========== ALFRESCO UPLOAD ==========");
//            log.info("Contract file name: {}", fileName);
//            log.info("Alfresco folder ID: {}", folderId);
//            log.info("Upload URL: {}", uploadUrl);
//            log.info("====================================");
//
//            if (response.getStatusCode() == HttpStatus.CREATED) {
//                return (String) ((Map) response.getBody().get("entry")).get("id");
//            } else {
//                throw new BadRequestAlertException("Failed to upload file to Alfresco. Response: " + response.getStatusCode(), "ALFRESCO", "upload_failed");
//            }
//        } catch (HttpClientErrorException e) {
//            if (e.getStatusCode() == HttpStatus.CONFLICT) {
//
//                String displayName = fileName
//                        .replace("_template.html", "")
//                        .replace(".html", "")
//                        .replace(".docx", "");
//
//
//
//
//                throw new BadRequestAlertException(
//                        "File '" + displayName + "' already exists in Alfresco.",
//                        ENTITY_NAME,
//                        "file_already_exists"
//                );
//            }
//            throw new BadRequestAlertException("Alfresco upload error: " + e.getMessage(), "ALFRESCO", "upload_failed");
//        }
//    }


    private String uploadInternal(
            Object resource,
            String fileName
    ) throws NoSuchAlgorithmException, KeyManagementException {

        String uploadUrl = alfrescoBaseUrl + folderId + "/children";

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", authToken);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        RestTemplate restTemplate = createSecureRestTemplate();

        try {
            // First attempt with the original filename
            return uploadToAlfresco(
                    restTemplate,
                    uploadUrl,
                    headers,
                    resource,
                    fileName
            );

        } catch (HttpClientErrorException e) {

            if (e.getStatusCode() == HttpStatus.CONFLICT) {

                log.warn(
                        "File '{}' already exists in Alfresco. " +
                                "Generating a unique filename instead.",
                        fileName
                );

                String uniqueFileName = generateUniqueFileName(fileName);

                log.info(
                        "Retrying Alfresco upload with unique filename: {}",
                        uniqueFileName
                );

                try {
                    return uploadToAlfresco(
                            restTemplate,
                            uploadUrl,
                            headers,
                            resource,
                            uniqueFileName
                    );

                } catch (HttpClientErrorException retryException) {

                    log.error(
                            "Failed to upload unique file '{}' to Alfresco. " +
                                    "Status: {}, Response: {}",
                            uniqueFileName,
                            retryException.getStatusCode(),
                            retryException.getResponseBodyAsString()
                    );

                    throw new BadRequestAlertException(
                            "Failed to upload file to Alfresco after generating a unique filename.",
                            "ALFRESCO",
                            "upload_failed"
                    );
                }
            }

            log.error(
                    "Alfresco upload failed. Status: {}, Response: {}",
                    e.getStatusCode(),
                    e.getResponseBodyAsString()
            );

            throw new BadRequestAlertException(
                    "Alfresco upload error: " + e.getMessage(),
                    "ALFRESCO",
                    "upload_failed"
            );
        }
    }

    private String generateUniqueFileName(String originalFileName) {

        int extensionIndex = originalFileName.lastIndexOf('.');

        if (extensionIndex > 0) {

            String baseName =
                    originalFileName.substring(0, extensionIndex);

            String extension =
                    originalFileName.substring(extensionIndex);

            return baseName + "_" +
                    UUID.randomUUID() +
                    extension;
        }

        return originalFileName + "_" + UUID.randomUUID();
    }

    @SuppressWarnings("unchecked")
    private String uploadToAlfresco(
            RestTemplate restTemplate,
            String uploadUrl,
            HttpHeaders headers,
            Object resource,
            String fileName
    ) {

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        body.add("filedata", resource);
        body.add("name", fileName);
        body.add("nodeType", "cm:content");

        HttpEntity<MultiValueMap<String, Object>> requestEntity =
                new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                uploadUrl,
                HttpMethod.POST,
                requestEntity,
                Map.class
        );

        if (response.getStatusCode() != HttpStatus.CREATED) {
            throw new BadRequestAlertException(
                    "Failed to upload file to Alfresco. Response: "
                            + response.getStatusCode(),
                    "ALFRESCO",
                    "upload_failed"
            );
        }

        Map<String, Object> responseBody = response.getBody();

        if (responseBody == null) {
            throw new BadRequestAlertException(
                    "Empty response received from Alfresco.",
                    "ALFRESCO",
                    "invalid_response"
            );
        }

        Map<String, Object> entry =
                (Map<String, Object>) responseBody.get("entry");

        if (entry == null || entry.get("id") == null) {
            throw new BadRequestAlertException(
                    "Alfresco response does not contain a node ID.",
                    "ALFRESCO",
                    "invalid_response"
            );
        }

        String nodeId = (String) entry.get("id");

        log.info(
                "File '{}' uploaded successfully to Alfresco. Node ID: {}",
                fileName,
                nodeId
        );

        return nodeId;
    }

    @Override
    public byte[] downloadFileFromAlfresco(String documentId) throws NoSuchAlgorithmException, KeyManagementException {
        String downloadUrl = alfrescoBaseUrl + documentId + "/content";
        HttpHeaders headers = new HttpHeaders();
        headers.set(AUTH, authToken);

        RestTemplate restTemplate = createSecureRestTemplate();
        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        ResponseEntity<byte[]> response = restTemplate.exchange(downloadUrl, HttpMethod.GET, requestEntity, byte[].class);

        if (response.getStatusCode() == HttpStatus.OK) {
            return response.getBody();
        } else {
            throw new BadRequestAlertException("Failed to download file from Alfresco. Response: " + response.getStatusCode(), "ALFRESCO", "unable_to_download");
        }
    }

    @Override
    public Map<String, String> getMetadata(String documentId) throws NoSuchAlgorithmException, KeyManagementException {
        String metadataUrl = alfrescoBaseUrl + documentId;
        HttpHeaders headers = new HttpHeaders();
        headers.set(AUTH, authToken);

        RestTemplate restTemplate = createSecureRestTemplate();
        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        ResponseEntity<Map> response = restTemplate.exchange(metadataUrl, HttpMethod.GET, requestEntity, Map.class);

        if (response.getStatusCode() == HttpStatus.OK) {
            Map<String, Object> entry = (Map<String, Object>) response.getBody().get("entry");
            String name = (String) entry.get("name");
            String mimeType = (String) ((Map<String, Object>) entry.get("content")).get("mimeType");

            Map<String, String> metadata = new HashMap<>();
            metadata.put("name", name);
            metadata.put("mimeType", mimeType);

            return metadata;
        } else {
            throw new BadRequestAlertException("Failed to fetch metadata from Alfresco. Response: " + response.getStatusCode(), "ALFRESCO", "unable_to_fetch");
        }
    }

    @Override
    public void deleteFile(String documentId) throws NoSuchAlgorithmException, KeyManagementException {
        String deleteUrl = alfrescoBaseUrl + documentId;
        HttpHeaders headers = new HttpHeaders();
        headers.set(AUTH, authToken);

        RestTemplate restTemplate = createSecureRestTemplate();
        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        ResponseEntity<Void> response = restTemplate.exchange(deleteUrl, HttpMethod.DELETE, requestEntity, Void.class);

        if (response.getStatusCode() != HttpStatus.NO_CONTENT) {
            throw new BadRequestAlertException("Failed to delete file from Alfresco. Response: " + response.getStatusCode(), "ALFRESCO", "unable_to_delete");
        }
    }
}
