// Draws every app icon from the HavenSpace mark (the doorway with a person inside).
// Run from the repo root:  swift scripts/icons/make-icons.swift
// Writes the Mac/Windows icons (native/desktop/build) and the web/Android ones (apps/web/public).
import AppKit

let tile = NSColor(srgbRed: 0x2E/255, green: 0x6E/255, blue: 0x6A/255, alpha: 1)   // brand colour, as in the web manifest
let tileTop = NSColor(srgbRed: 0x35/255, green: 0x7A/255, blue: 0x75/255, alpha: 1)
let tileBottom = NSColor(srgbRed: 0x2A/255, green: 0x66/255, blue: 0x60/255, alpha: 1)

/// The mark, `height` px tall, centred at (cx, cy). Same geometry as LogoMark (32-unit box).
func drawMark(cx: CGFloat, cy: CGFloat, height: CGFloat) {
  let s = height / 23            // the mark spans y 6.5…29.5 and x 7…25 in LogoMark units
  let t = NSAffineTransform()
  t.translateX(by: cx, yBy: cy)
  t.scaleX(by: s, yBy: -s)       // flip: SVG y goes down
  t.translateX(by: -16, yBy: -18)
  let door = NSBezierPath()
  door.move(to: NSPoint(x: 8.5, y: 28))
  door.line(to: NSPoint(x: 8.5, y: 15.5))
  door.appendArc(withCenter: NSPoint(x: 16, y: 15.5), radius: 7.5, startAngle: 180, endAngle: 0, clockwise: false)
  door.line(to: NSPoint(x: 23.5, y: 28))
  door.lineWidth = 3
  door.lineCapStyle = .round
  door.transform(using: t as AffineTransform)
  door.lineWidth = 3 * s
  NSColor.white.setStroke()
  door.stroke()
  let dot = NSBezierPath(ovalIn: NSRect(x: 16 - 3.4, y: 19.5 - 3.4, width: 6.8, height: 6.8))
  dot.transform(using: t as AffineTransform)
  NSColor.white.setFill()
  dot.fill()
}

func render(_ path: String, size: Int, draw: (CGFloat) -> Void) {
  // An sRGB canvas, so the colours above are written exactly as given.
  let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
  draw(CGFloat(size))
  NSGraphicsContext.restoreGraphicsState()
  let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
  print("wrote", path)
}

// Mac: Apple's grid (a 824 px tile on 1024, soft shadow, gentle gradient).
render("native/desktop/build/icon-mac.png", size: 1024) { n in
  let r = NSRect(x: 100, y: 100, width: 824, height: 824)
  let shape = NSBezierPath(roundedRect: r, xRadius: 185, yRadius: 185)
  NSGraphicsContext.saveGraphicsState()
  let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.28); shadow.shadowBlurRadius = 24; shadow.shadowOffset = NSSize(width: 0, height: -10)
  shadow.set(); tile.setFill(); shape.fill()
  NSGraphicsContext.restoreGraphicsState()
  NSGradient(starting: tileTop, ending: tileBottom)!.draw(in: shape, angle: -90)
  drawMark(cx: n / 2, cy: n / 2, height: 824 * 0.6)
}

// Windows / Linux, and the website's icons (also used by the Android app): rounded tile, full size.
for (path, size) in [("native/desktop/build/icon.png", 1024), ("apps/web/public/icon-512.png", 512), ("apps/web/public/icon-192.png", 192)] {
  render(path, size: size) { n in
    tile.setFill(); NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: n, height: n), xRadius: n * 0.225, yRadius: n * 0.225).fill()
    drawMark(cx: n / 2, cy: n / 2, height: n * 0.64)
  }
}

// Android "maskable" icon and the iPhone home-screen icon: full square, the system rounds or crops it.
// The mark stays inside the central safe circle (80 % of the width).
for (path, size, h) in [("apps/web/public/icon-maskable-512.png", 512, 0.56), ("apps/web/src/app/apple-icon.png", 180, 0.6)] {
  render(path, size: size) { n in
    tile.setFill(); NSRect(x: 0, y: 0, width: n, height: n).fill()
    drawMark(cx: n / 2, cy: n / 2, height: n * CGFloat(h))
  }
}
