import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Generates a clean multi-page A4 PDF from a DOM element.
 *
 * Strategy:
 *  1. Force the source element to A4-portrait dimensions while capturing
 *     so the rendered content actually fits the page width.
 *  2. Render via html2canvas at 2x scale for retina sharpness.
 *  3. Slice the resulting canvas into A4-height chunks and emit each as a page.
 *
 * @param {HTMLElement} element  The DOM node to capture.
 * @param {string} filename      The filename including .pdf extension.
 */
export async function downloadElementAsPdf(element, filename) {
  if (!element) throw new Error('No element to capture')

  // A4 in mm; we'll target this for the captured width
  const A4_W_MM = 210
  const A4_H_MM = 297
  const PX_PER_MM = 4 // 4 px per mm = 840 px wide canvas before 2x scale

  const targetWidthPx = A4_W_MM * PX_PER_MM // 840

  // Temporarily lock the element to the target width so layout reflows for A4.
  // Save originals so we can restore.
  const originalWidth = element.style.width
  const originalMaxWidth = element.style.maxWidth
  const originalPadding = element.style.padding
  element.style.width = `${targetWidthPx}px`
  element.style.maxWidth = `${targetWidthPx}px`

  // Wait for fonts and any pending layout work to settle
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready } catch { /* ignore */ }
  }
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => setTimeout(r, 50))

  let canvas
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: targetWidthPx,
      windowWidth: targetWidthPx,
    })
  } finally {
    // Restore original styles regardless of success/failure
    element.style.width = originalWidth
    element.style.maxWidth = originalMaxWidth
    element.style.padding = originalPadding
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pdfPageWMm = pdf.internal.pageSize.getWidth()      // 210
  const pdfPageHMm = pdf.internal.pageSize.getHeight()     // 297

  // Canvas px → mm conversion (canvas was rendered at scale=2)
  const mmPerCanvasPx = pdfPageWMm / canvas.width
  const pageHeightInCanvasPx = pdfPageHMm / mmPerCanvasPx

  let renderedCanvasPx = 0
  let pageIndex = 0

  while (renderedCanvasPx < canvas.height) {
    const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - renderedCanvasPx)

    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceHeight
    const ctx = slice.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, sliceHeight)
    ctx.drawImage(
      canvas,
      0, renderedCanvasPx, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight,
    )

    const img = slice.toDataURL('image/jpeg', 0.95)
    if (pageIndex > 0) pdf.addPage()
    pdf.addImage(img, 'JPEG', 0, 0, pdfPageWMm, sliceHeight * mmPerCanvasPx, '', 'FAST')

    renderedCanvasPx += sliceHeight
    pageIndex += 1
  }

  pdf.save(filename)
}
