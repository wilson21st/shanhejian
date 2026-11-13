// ./ocr img… → one line per image: file<TAB>recognised text (zh-Hant/zh-Hans/ja), used to match illustrated-book pages to poems
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
  guard let img = NSImage(contentsOfFile: path),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("\(path)\tERR"); continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.recognitionLanguages = ["zh-Hant", "zh-Hans", "ja-JP"]
  req.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: cg).perform([req])
  let t = (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
  print("\(path)\t\(t)")
}
