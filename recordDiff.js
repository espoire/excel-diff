function alignForComparison(control, test, mustMatches = []) {
  const controlRecords = toRecords(control);
  const    testRecords = toRecords(test);
  mustMatches = mustMatches.map(toFieldName);

  validateFields(controlRecords.fields, testRecords.fields);
  validateMustMatches(controlRecords.fields, testRecords.fields, mustMatches);

  const pairs = pairRecords(controlRecords, testRecords, mustMatches);
  const pasteableText = toExcelPastable(controlRecords.headers, testRecords.headers, controlRecords.fields, testRecords.fields, pairs);
  copy(pasteableText);

  return {
    count: pairs.length,
    pasteableText
  };
}

function toExcelPastable(controlHeaders, testHeaders, controlFields, testFields, pairs) {
  const lines = [];

  const headers = [
    ...controlHeaders,
    '',
    ...testHeaders
  ]

  lines.push(headers.join('\t'));

  for (const pair of pairs) {
    lines.push(
      [
        ...recordToDataArray(controlFields, pair.control),
        '',
        ...recordToDataArray(testFields, pair.test),
      ].join('\t')
    );
  }

  return lines.join('\n');
}

function recordToDataArray(fields, record) {
  if (record == null) return fields.map(x => null);

  const ret = [];

  for (const field of fields) {
    ret.push(record[field]);
  }

  return ret;
}

function validateFields(controlFields, testFields) {
  if (controlFields.length !== testFields.length) {
    throw new Error('Data does not have the same number of columns!', controlFields, testFields);
  }

  if (!memberwiseArrayEquals(
    controlFields,
    testFields
  )) {
    console.warn('Column headers not equal.', controlFields, testFields);
  }
}

function validateMustMatches(controlFields, testFields, mustMatches) {
  const missing = [];

  for (const field of mustMatches) {
    if (!controlFields.includes(field) || ! testFields.includes(field)) missing.push(field);
  }

  if (missing.length > 0) {
    throw new Error(`The following fields were specified as Must Match, but do not appear in the column headers of the comparison data. Double check spelling! ${missing.map(x => "'" + x + "'").join(',')}`);
  }
}

function pairRecords(controlRecords, testRecords, mustMatches) {
  optionalMatches = controlRecords.fields.filter(field => !mustMatches.includes(field));

  controlRecords.records.sort(by(mustMatches));
  testRecords   .records.sort(by(mustMatches));

  let unpairedControls = [...controlRecords.records];
  let unpairedTests    = [...   testRecords.records];

  /** @type {{control: object, test: object}[]} */
  const pairs = [];
  const fieldCount = controlRecords.fields.length;
  let comparisons = 0;
  for (let maxDiffs = 0; maxDiffs <= fieldCount; maxDiffs++) {

    for(let i = 0; i < unpairedControls.length; i++) {
      const control = unpairedControls[i];

      for(let j = 0; j < unpairedTests.length; j++) {
        const test = unpairedTests[j];

        comparisons++;
        if (!matches(control, test, mustMatches, optionalMatches, maxDiffs)) continue;

        pairs.push({
          control,
          test
        });

        quickArrayRemove(unpairedControls, i--);
        quickArrayRemove(unpairedTests, j);

        break;
      }
    }
  }

  console.log(comparisons);

  for (const control of unpairedControls) {
    pairs.push({
      control,
      test: null
    })
  }

  for (const test of unpairedTests) {
    pairs.push({
      control: null,
      test
    })
  }

  if (mustMatches.length > 0) pairs.sort(function (a, b) {
    for (const field of mustMatches) {
      const aVal = (a.control || a.test)[field];
      const bVal = (b.control || b.test)[field];
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  });

  return pairs;
}

function quickArrayRemove(array, index) {
  array[index] = array[array.length - 1];
  array.length--;
}

function matches(record1, record2, mustMatches, optionalMatches, maxDiffs) {
  for(const field of mustMatches) {
    if (record1[field] !== record2[field]) return false;
  }

  let diffs = 0;
  for(const field of optionalMatches) {
    if (record1[field] !== record2[field]) diffs++;
  }
  return (diffs <= maxDiffs);
}

function binarySearchArrayIncludes(sortedArray, searchElement) {
  let min = 0;
  let max = sortedArray.length - 1;

  while (min < max) {
    const test = Math.floor((min + max) / 2);
    const element = sortedArray[test];

    if (element < searchElement) {
      min = test + 1;

    } else if (element > searchElement) {
      max = test - 1;

    } else {
      return true;
    }
  }

  return (min === max && sortedArray[min] == searchElement);
}

function memberwiseArrayEquals(array1, array2) {
  if (array1.length !== array2.length) return false;
  const length = array1.length;

  for (let i = 0; i < length; i++) {
    if (array1[i] != array2[i]) return false;
  }

  return true;
}

function toRecords(raw) {
  const lines = raw.split('\n')
    .filter(line => line.length > 0);
  const tokens = lines.map(line =>
    line.split('\t')
  ).map(line => line.map(token => token.trim()));
  
  const headers = tokens[0]; 
  const fields = tokens[0].map(toFieldName);
  const records = [];
  
  for (let i = 1; i < tokens.length; i++) {
    const tokenRow = tokens[i];
    const record = {};
    
    for (let j = 0; j < fields.length; j++) {
      record[fields[j]] = tokenRow[j];
    }
    
    records.push(record);
  }
  
  return {
    headers,
    fields,
    records,
    count: records.length
  };
}

function logPerformance(fn, ...args) {
  const startTimeMillis = window.performance.now();
  
  const value = fn.apply(null, args);
  
  const endTimeMillis = window.performance.now();
  const elapsedMillis = endTimeMillis - startTimeMillis;
  
  const performance = {
    elapsedMillis
  };
  
  if (isObject(value)) {
    if (typeof value.count === 'number') {
      const millisPerRecord = elapsedMillis / value.count;
      performance.millisPerRecord = millisPerRecord;
    }
    
    return {
      performance,
      ...value
    };
  }
  
  return {
    performance,
    value
  };
}

function isObject(value) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value !== null
  );
}

function toFieldName(raw) {
  return toCamelCase(
    raw.replace('/', ' ')
      .replace('(', ' ')
      .replace(')', ' ')
      .replace('  ', ' ')
  );
}

function toCamelCase(raw) {
  const rawWords = raw.split(' ');
  const words = [];
  
  words.push(rawWords[0].toLowerCase());
  for (let i = 1; i < rawWords.length; i++) {
    words.push(capitalize(rawWords[i]));
  }
  
  return words.join('');
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() +
         word.slice(1) .toLowerCase();
}

function by(keys, direction = 'asc') {
  if (!Array.isArray(keys)) keys = [keys];
  direction = direction.toLowerCase();

  if (direction.startsWith('asc')) {
    direction = 'asc';

  } else if (direction.startsWith('desc')) {
    direction = 'desc';

  } else {
    throw new Error('Sort by() direction must be either "asc" or "desc". Provided:', direction);
  }

  return function(first, second) {
    for (const key of keys) {
      if (first[key] < second[key]) return direction === 'asc' ? -1 : 1;
      if (first[key] > second[key]) return direction === 'asc' ? 1 : -1;
    }
    return 0;
  }
}

logPerformance(alignForComparison, control, test, ['case', 'person', 'provider', 'check date']);