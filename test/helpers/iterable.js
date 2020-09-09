
module.exports = (dataArray, count, startIndex = 0) => {
  return async function* asyncGenerator() {
    let i = 0
    while (i < count) {
      yield {index: i, data: dataArray[startIndex + i++]}
    }
  }
}