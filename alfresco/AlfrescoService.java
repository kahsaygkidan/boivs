package standard_contract.alfresco.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import standard_contract.exception.BadRequestAlertException;

import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.Map;

@Service
public interface AlfrescoService {

    String uploadFileToAlfresco(MultipartFile file) throws NoSuchAlgorithmException, KeyManagementException;

    String uploadByteToAlfresco(byte[] fileBytes, String fileName) throws NoSuchAlgorithmException, KeyManagementException;

    byte[] downloadFileFromAlfresco(String documentId) throws NoSuchAlgorithmException, KeyManagementException, BadRequestAlertException;

    Map<String, String> getMetadata(String documentId) throws NoSuchAlgorithmException, KeyManagementException, BadRequestAlertException;

    void deleteFile(String documentId) throws NoSuchAlgorithmException, KeyManagementException, BadRequestAlertException;
}
