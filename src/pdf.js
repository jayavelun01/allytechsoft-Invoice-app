import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Renders a DOM element to a multi-page A4 PDF and triggers a download.
 *
 * @param {HTMLElement} element  The DOM node to capture (typically the printable doc).
 * @param {string} filename      The filename including .pdf extension.
 */
export async function downloadElementAsPdf(element, filename) {
  if (!element) throw new Error('No element to capture')

  // Render at 2x for crisp text on retina displays
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()       // 210
  const pageHeight = pdf.internal.pageSize.getHeight()      // 297

  // Map canvas pixels to mm at the chosen page width
  const pxPerMm = canvas.width / pageWidth
  const pageHeightPx = pageHeight * pxPerMm

  let renderedPx = 0
  let pageIndex = 0
  while (renderedPx < canvas.height) {
    // Slice off one page-height of pixels into a tmp canvas
    const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedPx)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceHeight
    const ctx = slice.getContext('2d')
    ctx.drawImage(
      canvas,
      0, renderedPx, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight,
    )

    const img = slice.toDataURL('image/jpeg', 0.92)
    if (pageIndex > 0) pdf.addPage()
    pdf.addImage(img, 'JPEG', 0, 0, pageWidth, sliceHeight / pxPerMm)

    renderedPx += sliceHeight
    pageIndex += 1
  }

  pdf.save(filename)
}
