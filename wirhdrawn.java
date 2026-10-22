-import { searchBoRecords } from '../api/bovsApi.js';
+import { removeBoRecord, searchBoRecords } from '../api/bovsApi.js';
-export default function Records({ onRegister, canRegister, onOpen }) {
+export default function Records({ onRegister, canRegister, canRemove, onOpen }) {

+  const removable = (r) => canRemove && (r.status === 'PENDING' || r.status === 'DRAFT');
+  const columnCount = canRemove ? COLUMN_COUNT + 1 : COLUMN_COUNT;

detail=============


        import { ..., rejectBoRecord, removeBoRecord, requestAmendment, ... } from '../api/bovsApi.js'

+  const handleRemove = async () => {
+    if (!window.confirm(`Remove ${record.boReference} from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return
+    setBusy(true)
+    setError(null)
+    try {
+      await removeBoRecord(id)
+      onBack()
+    } catch (err) {
+      setError(err.friendlyMessage || 'Failed to remove the record')
+      setBusy(false)
+    }
+  }

 // Actions card, inside the maker block:
+  {['DRAFT', 'PENDING'].includes(record.status) && (
+    <button className="btn btn-danger-outline" style={{ width: '100%' }} disabled={busy} onClick={handleRemove}>
+      Remove from list
+    </button>
+  )}
       
       +========records
       
       const handleRemove = async (e, r) => {
+    e.stopPropagation();
+    if (!window.confirm(`Remove ${r.boReference} (${r.fullName}) from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return;
+    try {
+      await removeBoRecord(r.id);
+      setRecords((list) => list.filter((x) => x.id !== r.id));
+    } catch (err) {
+      setError(err.friendlyMessage || 'Failed to remove the record');
+    }
+  };

   <th>Status</th>
+  {canRemove && <th>Action</th>}
 ...
   <StatusBadge status={r.status} /></td>
+  {canRemove && (
+    <td>
+      {removable(r) && (
+        <button type="button" className="btn btn-danger-outline btn-sm" onClick={(e) => handleRemove(e, r)}>Remove</button>
+      )}
+    </td>
+  )}
 // every colSpan={COLUMN_COUNT} becomes colSpan={columnCount}


record
       CEASED: "Ceased",
+  WITHDRAWN: "Removed",
 ...
   REJECTED: "Rejected",   // in approvalStatusLabel
+  WITHDRAWN: "Removed by maker",

api
+export const removeBoRecord = (id, reason) =>
+  apiClient.delete(`/bo-records/${id}`, { params: reason ? { reason } : undefined }).then((r) => r.data);

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
