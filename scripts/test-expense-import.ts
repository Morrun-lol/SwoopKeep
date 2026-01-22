import assert from 'node:assert/strict'
import xlsx from 'node-xlsx'
import { parseExpenseExcel } from '../src/main/services/excel'

const toArrayBuffer = (buf: Buffer) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer

const build = (rows: any[][]) => xlsx.build([{ name: 'Sheet1', data: rows, options: {} }])

{
  const buf = build([
    ['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注'],
    ['爸爸', '餐饮', '一日三餐', '午餐', '2025-01-14', 35.5, '牛肉面'],
    ['妈妈', '交通', '公共交通', '地铁', '2025-01-14', '5.0', '上班通勤'],
  ])
  const { rows, errors, headerVersion } = parseExpenseExcel(toArrayBuffer(buf))
  assert.equal(headerVersion, 'new')
  assert.equal(errors.length, 0)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].member_name, '爸爸')
  assert.equal(rows[0].amount, 35.5)
}

{
  const buf = build([
    ['项目', '分类', '子分类', '日期', '金额', '备注'],
    ['餐饮', '一日三餐', '午餐', '2025/01/14', '￥35.5', '牛肉面'],
    ['交通', '公共交通', '地铁', '2025年1月14日', 'abc', ''],
  ])
  const { rows, errors, headerVersion } = parseExpenseExcel(toArrayBuffer(buf))
  assert.equal(headerVersion, 'old')
  assert.equal(rows.length, 1)
  assert.equal(errors.length, 1)
  assert.equal(errors[0].rowNumber, 3)
}

{
  const many: any[][] = [['费用归属', '项目', '分类', '子分类', '日期', '金额', '备注']]
  for (let i = 0; i < 5000; i++) {
    many.push(['A', '餐饮', '分类', '', '2025-01-01', 1, ''])
  }
  const buf = build(many)
  const { rows, errors } = parseExpenseExcel(toArrayBuffer(buf))
  assert.equal(errors.length, 0)
  assert.equal(rows.length, 5000)
}

console.log('OK')

