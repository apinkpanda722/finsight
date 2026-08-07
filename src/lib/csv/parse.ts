export type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

export function parseCsv(text: string): ParsedCsv {
  if (text.length === 0) {
    throw new Error("CSV must contain a header row")
  }
  if (text.includes("\0")) {
    throw new Error("CSV contains a NUL byte")
  }

  const records: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let afterClosingQuote = false
  let endedWithRecordDelimiter = false

  const pushField = () => {
    row.push(field)
    field = ""
    afterClosingQuote = false
  }

  const pushRecord = () => {
    pushField()
    records.push(row)
    row = []
    endedWithRecordDelimiter = true
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
          afterClosingQuote = true
        }
      } else {
        field += character
      }
      endedWithRecordDelimiter = false
      continue
    }

    if (afterClosingQuote) {
      if (character === ",") {
        pushField()
        endedWithRecordDelimiter = false
        continue
      }
      if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] === "\n") index += 1
        pushRecord()
        continue
      }

      throw new Error("Unexpected character after a quoted CSV field")
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("Unexpected quote in an unquoted CSV field")
      }
      inQuotes = true
      endedWithRecordDelimiter = false
    } else if (character === ",") {
      pushField()
      endedWithRecordDelimiter = false
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1
      pushRecord()
    } else {
      field += character
      endedWithRecordDelimiter = false
    }
  }

  if (inQuotes) {
    throw new Error("Unterminated quoted CSV field")
  }

  if (!endedWithRecordDelimiter) {
    pushField()
    records.push(row)
  }

  const [headers, ...rows] = records
  if (!headers) {
    throw new Error("CSV must contain a header row")
  }

  for (const dataRow of rows) {
    if (dataRow.length !== headers.length) {
      throw new Error("CSV row column count does not match the header")
    }
  }

  return { headers, rows }
}
