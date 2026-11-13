// Apple Vision (on-device) detections for focal/crop planning.
// swiftc -O vision.swift -o vision ; ./vision img1.jpg img2.jpg … > out.jsonl
// Boxes are normalised [x, y, w, h] with a TOP-LEFT origin (Vision's bottom-left is flipped here).
import Foundation
import Vision
import AppKit

func flip(_ r: CGRect) -> [Double] { [Double(r.minX), Double(1 - r.maxY), Double(r.width), Double(r.height)].map { ($0 * 10000).rounded() / 10000 } }

func box(_ a: [VNDetectedObjectObservation]) -> [[String: Any]] {
  var r: [[String: Any]] = []
  for o in a { let d: [String: Any] = ["b": flip(o.boundingBox), "c": Double(o.confidence)]; r.append(d) }
  return r
}

for path in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: path)
  var out: [String: Any] = ["file": url.lastPathComponent]
  guard let img = NSImage(contentsOf: url), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    out["error"] = "load"; print(String(data: try! JSONSerialization.data(withJSONObject: out), encoding: .utf8)!); continue
  }
  out["px"] = [cg.width, cg.height]
  let faces = VNDetectFaceRectanglesRequest()
  let land = VNDetectFaceLandmarksRequest()
  let humans = VNDetectHumanRectanglesRequest(); humans.upperBodyOnly = false
  let upper = VNDetectHumanRectanglesRequest(); upper.upperBodyOnly = true
  let pose = VNDetectHumanBodyPoseRequest()
  let animals = VNRecognizeAnimalsRequest()
  let att = VNGenerateAttentionBasedSaliencyImageRequest()
  let obj = VNGenerateObjectnessBasedSaliencyImageRequest()
  let h = VNImageRequestHandler(cgImage: cg, options: [:])
  try? h.perform([faces, land, humans, upper, pose, animals, att, obj])
  out["faces"] = box(faces.results ?? [])
  out["humans"] = box(humans.results ?? [])
  out["upper"] = box(upper.results ?? [])
  out["animals"] = box(animals.results ?? [])
  // heads from body pose: nose/eyes/ears/neck points (normalised, top-left origin)
  var heads: [[String: Any]] = []
  for o in pose.results ?? [] {
    let names: [VNHumanBodyPoseObservation.JointName] = [.nose, .leftEye, .rightEye, .leftEar, .rightEar, .neck]
    var pts: [[Double]] = []
    for n in names { if let p = try? o.recognizedPoint(n), p.confidence > 0.2 { pts.append([Double(p.location.x), Double(1 - p.location.y)]) } }
    if pts.count >= 2 { heads.append(["pts": pts, "c": Double(o.confidence)]) }
  }
  out["poseHeads"] = heads
  out["attention"] = box(att.results?.first?.salientObjects ?? [])
  out["objectness"] = box(obj.results?.first?.salientObjects ?? [])
  print(String(data: try! JSONSerialization.data(withJSONObject: out), encoding: .utf8)!)
}
