/**
 * Capacity Management Constants
 * 
 * Shared constants for capacity limits and management
 */

/**
 * Represents "unlimited" capacity in the UI
 * 
 * This large number (999,999) is used as a practical "unlimited" value because:
 * 1. It's larger than any realistic capacity the system will handle
 * 2. It's displayable as "∞" in the UI for better UX
 * 3. It's a safe integer that won't cause overflow issues
 * 4. It's clearly distinguishable from normal capacity values
 * 
 * Note: If the system ever needs to support larger limits, this value can be increased.
 * The UI formatting logic will automatically handle values >= this constant.
 */
const CAPACITY_UNLIMITED_VALUE = 999999;

module.exports = {
  CAPACITY_UNLIMITED_VALUE,
};
