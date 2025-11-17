// Data Structures and Algorithms for Loan Management System

/**
 * Quick Sort implementation for sorting loans by various criteria
 * Time Complexity: O(n log n) average, O(n^2) worst case
 */
export function quickSort(arr, compareFn) {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const left = [];
  const right = [];
  const equal = [];

  for (const item of arr) {
    const cmp = compareFn(item, pivot);
    if (cmp < 0) left.push(item);
    else if (cmp > 0) right.push(item);
    else equal.push(item);
  }

  return [...quickSort(left, compareFn), ...equal, ...quickSort(right, compareFn)];
}

/**
 * Binary Search for finding installments in repayment schedule
 * Time Complexity: O(log n)
 */
export function binarySearchInstallment(schedule, installmentNo) {
  let left = 0;
  let right = schedule.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midInstallment = schedule[mid].installmentNo;

    if (midInstallment === installmentNo) {
      return schedule[mid];
    } else if (midInstallment < installmentNo) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return null; // Not found
}

/**
 * Priority Queue implementation using Min-Heap for managing due dates
 * Useful for finding next due payments or overdue loans
 */
export class PriorityQueue {
  constructor(compareFn = (a, b) => a - b) {
    this.heap = [];
    this.compare = compareFn;
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.isEmpty()) return null;
    const root = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return root;
  }

  peek() {
    return this.isEmpty() ? null : this.heap[0];
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  size() {
    return this.heap.length;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      let left = 2 * index + 1;
      let right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

/**
 * Hash Map for fast loan lookups by ID
 * Time Complexity: O(1) average for lookups
 */
export class LoanHashMap {
  constructor() {
    this.map = new Map();
  }

  set(key, value) {
    this.map.set(key, value);
  }

  get(key) {
    return this.map.get(key);
  }

  has(key) {
    return this.map.has(key);
  }

  delete(key) {
    return this.map.delete(key);
  }

  keys() {
    return Array.from(this.map.keys());
  }

  values() {
    return Array.from(this.map.values());
  }

  entries() {
    return Array.from(this.map.entries());
  }

  size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

/**
 * Optimized Amortization Schedule Calculator with better precision
 * Uses BigInt for financial calculations to avoid floating point errors
 */
export function optimizedAmortization(amount, annualRatePercent, months, startDate = new Date()) {
  // Convert to BigInt for precision (multiply by 10000 to handle 4 decimal places)
  const scale = 10000n;
  const principal = BigInt(Math.round(amount * 10000));
  const monthlyRate = BigInt(Math.round((annualRatePercent / 100 / 12) * 10000));
  const numMonths = BigInt(months);

  // Calculate EMI using BigInt arithmetic
  let emi = 0n;
  if (monthlyRate === 0n) {
    emi = principal / numMonths;
  } else {
    const numerator = principal * monthlyRate * ((1n + monthlyRate) ** numMonths);
    const denominator = ((1n + monthlyRate) ** numMonths) - 1n;
    emi = numerator / denominator;
  }

  // Convert back to number for schedule
  const emiAmount = Number(emi) / 10000;
  const roundedEmi = Math.round(emiAmount * 100) / 100;

  let balance = amount;
  const schedule = [];

  for (let i = 1; i <= months; i++) {
    const interest = Math.round((balance * (annualRatePercent / 100 / 12)) * 100) / 100;
    const principalPayment = Math.round((roundedEmi - interest) * 100) / 100;
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installmentNo: i,
      dueDate,
      principal: principalPayment,
      interest,
      total: roundedEmi,
      paid: false
    });

    balance = Math.round((balance - principalPayment) * 100) / 100;
  }

  return schedule;
}

/**
 * Merge Sort for stable sorting of loan data
 * Time Complexity: O(n log n), Space Complexity: O(n)
 */
export function mergeSort(arr, compareFn) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compareFn);
  const right = mergeSort(arr.slice(mid), compareFn);

  return merge(left, right, compareFn);
}

function merge(left, right, compareFn) {
  const result = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (compareFn(left[leftIndex], right[rightIndex]) <= 0) {
      result.push(left[leftIndex]);
      leftIndex++;
    } else {
      result.push(right[rightIndex]);
      rightIndex++;
    }
  }

  return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}

/**
 * Linear Search with early termination for small datasets
 * Useful when binary search overhead isn't worth it
 */
export function linearSearchWithEarlyTermination(arr, predicate, maxIterations = 100) {
  for (let i = 0; i < Math.min(arr.length, maxIterations); i++) {
    if (predicate(arr[i])) {
      return arr[i];
    }
  }
  return null;
}

/**
 * Bloom Filter for checking loan existence (space-efficient)
 * Useful for large-scale loan existence checks
 */
export class BloomFilter {
  constructor(size = 10000, hashFunctions = 3) {
    this.size = size;
    this.hashFunctions = hashFunctions;
    this.bitArray = new Array(size).fill(false);
  }

  _hash(value, seed) {
    let hash = 0;
    const str = String(value);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i) + seed) & 0xffffffff;
    }
    return Math.abs(hash) % this.size;
  }

  add(value) {
    for (let i = 0; i < this.hashFunctions; i++) {
      const index = this._hash(value, i);
      this.bitArray[index] = true;
    }
  }

  mightContain(value) {
    for (let i = 0; i < this.hashFunctions; i++) {
      const index = this._hash(value, i);
      if (!this.bitArray[index]) {
        return false;
      }
    }
    return true;
  }
}
