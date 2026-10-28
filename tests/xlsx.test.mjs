import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { crc32 as nodeCrc32 } from "node:zlib";

import { buildXlsx, crc32 } from "../assets/js/core/xlsx.js";

// zip 안의 파일을 이름 → 내용으로 꺼낸다. STORE만 쓰므로 압축 해제가 필요 없다
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const data = bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    files[name] = { crc, data, text: new TextDecoder().decode(data) };
    at += 30 + nameLength + size;
  }
  return files;
}

describe("xlsx 작성기", () => {
  const bytes = buildXlsx([
    { name: "Experiment A", widths: [8, 12], rows: [[{ v: "Run", bold: true }, { v: "Voltage (V)", bold: true }], ["a", 5], ["b", "1,2 <bad>"], []] },
    { name: "Bad/Name?", rows: [["T8 (°C)", 24.8]] }
  ]);
  const files = unzip(bytes);

  test("CRC32가 Node 구현과 같다", () => {
    for (const sample of ["", "a", "°C 온도", "x".repeat(1000)]) {
      const data = new TextEncoder().encode(sample);
      assert.equal(crc32(data), nodeCrc32(data));
    }
  });

  test("엑셀이 요구하는 부품이 모두 있고 CRC가 맞다", () => {
    for (const name of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
      assert.ok(files[name], `${name} 없음`);
      assert.equal(files[name].crc, nodeCrc32(files[name].data), `${name} CRC 불일치`);
    }
  });

  test("숫자는 숫자 셀, 글자는 이스케이프된 글자 셀", () => {
    const sheet = files["xl/worksheets/sheet1.xml"].text;
    assert.match(sheet, /<c r="B2"><v>5<\/v><\/c>/);
    assert.match(sheet, /<c r="B3" t="inlineStr"><is><t xml:space="preserve">1,2 &lt;bad&gt;<\/t><\/is><\/c>/);
    assert.match(sheet, /<c r="A1" t="inlineStr" s="1">/);
  });

  test("시트 이름에서 쓸 수 없는 문자를 지운다", () => {
    assert.match(files["xl/workbook.xml"].text, /name="Bad Name "/);
  });
});
