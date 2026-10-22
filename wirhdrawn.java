+   /** Removes (withdraws) a record that is still a draft or pending verification. */
+   @DeleteMapping("/{id}")
+   @PreAuthorize("hasAnyRole('MAKER','ADMIN')")
+   public ResponseEntity<Void> remove(@PathVariable String id, @RequestParam(required = false) String reason) {
+       beneficialOwnerService.withdraw(id, reason);
+       return ResponseEntity.noContent().build();
+   }


+   @Transactional
+   @Override
+   public BeneficialOwner withdraw(String id, String reason) {
+       BeneficialOwner bo = getById(id);
+       if (bo.getStatus() != BoStatus.DRAFT && bo.getStatus() != BoStatus.PENDING) {
+           throw new InvalidWorkflowStateException(
+                   "Only draft or pending records can be removed; verified records are retained");
+       }
+       boolean wasPending = bo.getStatus() == BoStatus.PENDING;
+       bo.setStatus(BoStatus.WITHDRAWN);
+       bo.setRejectionReason(blankToNull(reason));
+       bo.setUpdatedBy(currentUser.username());
+       BeneficialOwner saved = boRepository.save(bo);
+       if (saved.getOwnershipNodeId() != null) {
+           ownershipStructureService.markLinked(saved.getOwnershipNodeId(), null); // person can be registered again
+       }
+       auditService.record("BENEFICIAL_OWNER", saved.getBoReference(), AuditAction.BO_WITHDRAWN,
+               reason == null || reason.isBlank() ? "Removed by maker before verification" : "Removed by maker: " + reason);
+       approvalService.recordWithdrawal(saved, reason);
+       if (wasPending) {
+           notificationService.notifyCheckersWithdrawn(saved, reason);
+       }
+       return saved;
+   }

    // stats(): removed records are not counted
-   long total = boRepository.count();
+   long total = boRepository.count() - boRepository.countByStatus(BoStatus.WITHDRAWN);
