/* ==========================================================================
   High-risk sector notification helper
   ========================================================================== */
export const HIGH_RISK_SECTOR_LABELS = {
  MINING: 'Mining',
  REAL_ESTATE: 'Real Estate',
  MOTOR_DEALERSHIP: 'Motor Dealership',
  IMPORT_EXPORT: 'Import / Export',
};

/**
 * Returns notification info when the entity/sector combination triggers
 * the reduced beneficial-ownership threshold (or another high-risk flag).
 * Returns null when no notification is needed.
 */
export function getHighRiskNotice(entityType, sector) {
  if (!sector || !HIGH_RISK_SECTORS.has(sector)) return null;
  const sectorLabel = HIGH_RISK_SECTOR_LABELS[sector] || sector;

  // The 5% reduced threshold only applies to Share Companies
  if (entityType === 'SHARE_COMPANY') {
    return {
      tone: 'warn',
      badge: 'HIGH RISK',
      title: `High-risk sector — reduced 5% threshold applies`,
      body: `This Share Company operates in ${sectorLabel}, a Directive-specified high-risk sector. The beneficial-ownership threshold is reduced from 10% to 5%.`,
      note: 'Ensure all holders with ≥ 5% direct or indirect ownership are captured as beneficial owners.',
    };
  }

  // High-risk sector but not a Share Company — still flag for review
  if (sector === 'MINING' || sector === 'REAL_ESTATE') {
    return {
      tone: 'warn',
      badge: 'HIGH RISK',
      title: `High-risk sector — ${sectorLabel}`,
      body: `This customer operates in ${sectorLabel}, a Directive-specified high-risk sector. Apply enhanced due diligence.`,
      note: 'The standard threshold for this entity type still applies, but EDD is required.',
    };
  }

  return {
    tone: 'info',
    badge: 'HIGH RISK',
    title: `High-risk sector — ${sectorLabel}`,
    body: `This customer operates in ${sectorLabel}, a Directive-specified high-risk sector.`,
    note: 'Apply enhanced due diligence per the Directive.',
  };
}