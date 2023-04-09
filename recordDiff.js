// TODOs
// Group records by mustMatches

function alignForComparison(control, test, mustMatches = []) {
  const controlRecords = toRecords(control);
  const    testRecords = toRecords(test);
  mustMatches = mustMatches.map(toFieldName);

  validateFields(controlRecords.fields, testRecords.fields);
  validateMustMatches(controlRecords.fields, testRecords.fields, mustMatches);

  const pairs = pairRecords(controlRecords, testRecords, mustMatches);
  const pasteableText = toExcelPastable(
    controlRecords.headers,
    testRecords.headers,
    pairs
  );

  return {
    count: pairs.length,
    pasteableText
  };
}

function toExcelPastable(controlHeaders, testHeaders, pairs) {
  const lines = [];
  const numColumns = controlHeaders.length - 1;
  
  lines.push(
    controlHeaders[numColumns] +
    '\t\t' +
    testHeaders[numColumns]
  );
  
  const placeholderTsv = repeat('\t', numColumns - 1);
  for (const pair of pairs) {
    lines.push(
      (pair.control ? pair.control[numColumns] : placeholderTsv) +
      '\t\t' +
      (pair.test ? pair.test[numColumns] : placeholderTsv)
    );
  }

  return lines.join('\n');
}

function repeat(string, times) {
  return new Array(times + 1).join(string);
}

function validateFields(controlFields, testFields) {
  if (controlFields.length !== testFields.length) {
    console.error('Data does not have the same number of columns!', controlFields, testFields);
    throw new Error('Data does not have the same number of columns!');
  }

  if (!memberwiseArrayEquals(controlFields, testFields)) {
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

function allIntegersLessThan(max) {
  const ret = [];
  for (let n = 0; n < max; n++) ret.push(n);
  return ret;
}

function pairRecords(controlRecords, testRecords, mustMatches) {
  const fieldCount = controlRecords.fields.length;

  const mustMatchIndecies = mustMatches.map(field =>
    controlRecords.fields.indexOf(field)
  );
  optionalMatchIndecies = allIntegersLessThan(fieldCount).filter(index =>
    !mustMatchIndecies.includes(index)
  );

  controlRecords.tokens.sort(by(mustMatchIndecies));
  testRecords   .tokens.sort(by(mustMatchIndecies));

  // TODO remove the array copy?
  let unpairedControls = [...controlRecords.tokens];
  let unpairedTests    = [...   testRecords.tokens];
  unpairedControlsStart = 0;
  unpairedTestsStart    = 0;

  /** @type {{control: object, test: object}[]} */
  const pairs = [];
  let comparisons = 0;
  for (let maxDiffs = 0; maxDiffs <= fieldCount; maxDiffs++) {

    for(let i = unpairedControlsStart; i < unpairedControls.length; i++) {
      const control = unpairedControls[i];

      for(let j = unpairedTestsStart; j < unpairedTests.length; j++) {
        const test = unpairedTests[j];

        comparisons++;
        if (!matches(control, test, mustMatchIndecies, optionalMatchIndecies, maxDiffs)) continue;

        pairs.push({
          control,
          test
        });

        // TODO create managed array class?
        // Needed to inline for performance; adding the .start property
        // onto the arrays forced the Chromium engine to use unoptimized
        // implementation of arrays-with-props, instead of the standard
        // array type.
        unpairedControls[i] = unpairedControls[unpairedControlsStart++];
        unpairedTests[j] = unpairedTests[unpairedTestsStart++];

        break;
      }
    }
  }

  // TODO move into return value
  console.log(comparisons);

  for(let i = unpairedControlsStart; i < unpairedControls.length; i++) {
    pairs.push({
      control: unpairedControls[i],
      test: null
    });
  }

  for(let j = unpairedTestsStart; j < unpairedTests.length; j++) {
    pairs.push({
      control: null,
      test: unpairedTests[j]
    });
  }

  if (mustMatchIndecies.length > 0) pairs.sort(function pairsSorter(a, b) {
    const aRecord = (a.control || a.test);
    const bRecord = (b.control || b.test);

    for (const i of mustMatchIndecies) {
      const aVal = aRecord[i];
      const bVal = bRecord[i];
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  });

  return pairs;
}

function matches(record1, record2, mustMatchIndecies, optionalMatchIndecies, maxDiffs) {
  for(const i of mustMatchIndecies) {
    if (record1[i] !== record2[i]) return false;
  }

  let diffs = 0;
  for(const i of optionalMatchIndecies) {
    if (record1[i] !== record2[i]) diffs++;
  }
  return (diffs <= maxDiffs);
}

function memberwiseArrayEquals(array1, array2) {
  if (array1.length !== array2.length) return false;
  const length = array1.length;

  for (let i = 0; i < length; i++) {
    if (array1[i] != array2[i]) return false;
  }

  return true;
}

// This function only given a name to make the profiling logs more readable.
// Otherwise, we'd just use an arrow function in-line.
function trim(token) {
  return token.trim();
}

// This function only given a name to make the profiling logs more readable.
// Otherwise, we'd just use an arrow function in-line.
function blankLines(line) {
  return line.length > 0;
}

// This function only given a name to make the profiling logs more readable.
// Otherwise, we'd just use an arrow function in-line.
function toRecord(line) {
  const record = line.split('\t');

  // Replace in-place (instead of .map()) for memory usage.
  // No helper function for function call overhead.
  // (This section is HOT.)
  for (let i = 0; i < record.length; i++) {
    record[i] = record[i].trim();
  }

  record.push(line);
  return record;
}

function toRecords(raw) {
  const tokens = raw.split('\n').filter(blankLines).map(toRecord);
  const headers = tokens[0];
  tokens.shift();

  let fields = [...headers];
  fields.pop();
  fields = fields.map(toFieldName);

  return {
    tokens,
    headers,
    fields,
    count: tokens.length
  };
}

function logPerformance(fn, ...args) {
  const startTimeMillis = window.performance.now();
  
  const value = fn(...args);
  
  const endTimeMillis = window.performance.now();
  const elapsedMillis = endTimeMillis - startTimeMillis;
  
  const performance = { elapsedMillis };
  
  if (isObject(value)) {
    if (typeof value.count === 'number') {
      const millisPerRecord = elapsedMillis / value.count;
      performance.millisPerRecord = millisPerRecord;
    }
    
    value.performance = performance;

    return value;
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

function by(keys) {
  return function sortBy(first, second) {
    for (const key of keys) {
      const firstVal = first[key];
      const secondVal = second[key];
      if (firstVal < secondVal) return -1;
      if (firstVal > secondVal) return 1;
    }
    return 0;
  }
}

logPerformance(alignForComparison, control, test, ['case', 'person', 'provider', 'check date']);