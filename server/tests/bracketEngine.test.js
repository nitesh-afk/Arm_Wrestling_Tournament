import { getNextPowerOfTwo, generateSeedOrder } from '../src/services/bracketEngine.js';

console.log('--- Testing bracketEngine Helper Algorithms ---');

// Test 1: Power of 2 sizing
const testSizes = [2, 3, 4, 5, 7, 8, 9, 15, 16];
const expectedSizes = [4, 4, 4, 8, 8, 8, 16, 16, 16];

testSizes.forEach((n, idx) => {
  const result = getNextPowerOfTwo(n);
  if (result === expectedSizes[idx]) {
    console.log(`✓ getNextPowerOfTwo(${n}) = ${result}`);
  } else {
    console.error(`✗ getNextPowerOfTwo(${n}) expected ${expectedSizes[idx]} but got ${result}`);
    process.exit(1);
  }
});

// Test 2: Seed ordering for N=4, 8, 16
const seed4 = generateSeedOrder(4);
console.log('Seed Order N=4:', seed4);
if (seed4.length === 4 && seed4[0] === 1 && seed4[1] === 4) {
  console.log('✓ Seed order N=4 valid');
} else {
  console.error('✗ Invalid seed order N=4');
  process.exit(1);
}

const seed8 = generateSeedOrder(8);
console.log('Seed Order N=8:', seed8);
if (seed8.length === 8 && seed8[0] === 1 && seed8[1] === 8) {
  console.log('✓ Seed order N=8 valid');
} else {
  console.error('✗ Invalid seed order N=8');
  process.exit(1);
}

console.log('--- All bracketEngine unit tests passed! ---');
