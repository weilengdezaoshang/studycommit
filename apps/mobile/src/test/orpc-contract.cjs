class ContractBuilder {
  route() {
    return this
  }

  input() {
    return this
  }

  output() {
    return this
  }
}

exports.oc = new ContractBuilder()

// 解释卡契约曾使用的流式迭代器:保留导出以兼容契约源码的静态导入。
exports.eventIterator = () => undefined
