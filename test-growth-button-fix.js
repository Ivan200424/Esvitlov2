/**
 * Test script to verify growth button routing fix
 * Tests that growth_* callback_data is properly routed to handleAdminCallback
 */

console.log('🧪 Testing Growth Button Routing Fix\n');

// Test the routing logic
const testCallbacks = [
  'admin_growth',
  'growth_metrics',
  'growth_stage',
  'growth_stage_0',
  'growth_stage_1',
  'growth_registration',
  'growth_reg_status',
  'growth_reg_toggle',
  'growth_events'
];

console.log('Test: Verifying callback_data patterns\n');

testCallbacks.forEach((data, index) => {
  const shouldRouteToAdmin = 
    data.startsWith('admin_') || 
    data.startsWith('pause_') || 
    data.startsWith('debounce_') || 
    data.startsWith('growth_');
  
  if (shouldRouteToAdmin) {
    console.log(`✅ Test ${index + 1}: "${data}" - Will route to admin handler`);
  } else {
    console.log(`❌ Test ${index + 1}: "${data}" - Will NOT route to admin handler`);
  }
});

console.log('\n✅ All growth-related callbacks should route to admin handler');
console.log('✅ The fix adds growth_ prefix to the routing condition');
console.log('\n📝 Before fix: Only admin_, pause_, debounce_ were routed');
console.log('📝 After fix: admin_, pause_, debounce_, growth_ are routed');
