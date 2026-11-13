// ./textbox img… → JSON line per image: {"file","text":[[x,y,w,h],…]} normalised, TOP-LEFT origin.
// Inscriptions/seals carry dense ink; focal.py masks these so the focus lands on the picture, not the calligraphy.
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
  guard let img = NSImage(contentsOfFile: path),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let rec = VNRecognizeTextRequest()
  rec.recognitionLevel = .accurate
  rec.recognitionLanguages = ["zh-Hant", "zh-Hans", "ja-JP"]
  rec.usesLanguageCorrection = false
  let rect = VNDetectTextRectanglesRequest()
  try? VNImageRequestHandler(cgImage: cg).perform([rec, rect])
  var boxes: [[Double]] = []
  let all: [CGRect] = (rec.results ?? []).map { $0.boundingBox } + (rect.results ?? []).map { $0.boundingBox }
  for r in all { boxes.append([r.minX, 1 - r.maxY, r.width, r.height].map { (Double($0) * 10000).rounded() / 10000 }) }
  let o: [String: Any] = ["file": (path as NSString).lastPathComponent, "text": boxes]
  print(String(data: try! JSONSerialization.data(withJSONObject: o), encoding: .utf8)!)
}
