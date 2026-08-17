import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getOrderedItemDisplayName } from './orderItemDisplay';

const getInvoiceNumber = (order) => {
    const savedInvoiceNumber = String(order?.invoiceNumber || '').trim();
    if (savedInvoiceNumber) return savedInvoiceNumber;
    return `INV-${String(order?.displayId || order?.id || order?._id || '').toUpperCase()}`;
};

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getCodAdvancedSummary = (order) => {
    const codAdvancedAmount = toNumber(order?.codAdvancedAmount);
    const remainingCodBalance = toNumber(order?.remainingCodBalance);
    const isCodAdvancedPaid = Boolean(order?.isCodAdvancedPaid) && codAdvancedAmount > 0;

    return {
        isCodAdvancedPaid,
        codAdvancedAmount,
        remainingCodBalance
    };
};

/**
 * Generate and download invoice PDF for an order
 * @param {Object} order - Order object containing all order details
 */
export const generateInvoice = (order, settings = {}) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const { isCodAdvancedPaid, codAdvancedAmount, remainingCodBalance } = getCodAdvancedSummary(order);

    // Default settings if not provided
    const seller = {
        name: settings?.sellerName || 'JAIPURIO',
        address: settings?.sellerAddress || '123 E-com St, Digital City',
        gst: settings?.gstNumber || 'N/A',
        pan: settings?.panNumber || 'N/A',
        logo: settings?.logoUrl || ''
    };

    // Colors
    const primaryColor = [41, 98, 255]; // Blue
    const darkColor = [31, 41, 55]; // Dark gray
    const lightColor = [107, 114, 128]; // Light gray

    // Header Section
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Company Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text(seller.name.toUpperCase(), 15, 20);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Your Trusted Shopping Partner', 15, 28);

    // Invoice Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('TAX INVOICE', pageWidth - 15, 25, { align: 'right' });

    // Reset text color
    doc.setTextColor(...darkColor);

    // Invoice Details Box
    let yPos = 50;

    // Invoice Number and Date row
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Invoice Number:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(getInvoiceNumber(order), 45, yPos);

    doc.setFont(undefined, 'bold');
    doc.text('Invoice Date:', pageWidth - 85, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(new Date().toLocaleDateString('en-IN'), pageWidth - 15, yPos, { align: 'right' });

    yPos += 6;
    doc.setFont(undefined, 'bold');
    doc.text('Order Date:', 15, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(order.createdAt).toLocaleDateString('en-IN'), 45, yPos);

    doc.setFont(undefined, 'bold');
    doc.text('Order ID:', pageWidth - 85, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(`#${(order.displayId || order.id || order._id).toUpperCase()}`, pageWidth - 15, yPos, { align: 'right' });

    yPos += 12;

    // Billing and Shipping Information
    doc.setDrawColor(230, 230, 230);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 10;

    // THREE column layout for addresses
    const colWidth = (pageWidth - 40) / 3;
    const col1 = 15;
    const col2 = col1 + colWidth + 5;
    const col3 = col2 + colWidth + 5;

    // Titles
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...lightColor);
    doc.text('SOLD BY', col1, yPos);
    doc.text('BILL TO', col2, yPos);
    doc.text('SHIP TO', col3, yPos);

    yPos += 7;
    doc.setTextColor(...darkColor);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    
    // Column 1: Seller
    let y1 = yPos;
    doc.text(seller.name, col1, y1);
    y1 += 4;
    doc.setFont(undefined, 'normal');
    const sellerAddr = doc.splitTextToSize(seller.address, colWidth);
    doc.text(sellerAddr, col1, y1);
    y1 += (sellerAddr.length * 4);
    doc.setFont(undefined, 'bold');
    doc.text(`GST: ${seller.gst}`, col1, y1);

    // Column 2: Billing
    let y2 = yPos;
    const billingName = order.user?.name || order.shippingAddress?.name || 'Customer';
    doc.text(billingName, col2, y2);
    y2 += 4;
    doc.setFont(undefined, 'normal');
    if (order.user?.email) {
        doc.text(order.user.email, col2, y2);
        y2 += 4;
    }
    if (order.user?.phone || order.shippingAddress?.phone) {
        doc.text((order.user?.phone || order.shippingAddress?.phone), col2, y2);
        y2 += 4;
    }

    // Column 3: Shipping
    let y3 = yPos;
    const shippingName = order.shippingAddress?.name || order.user?.name || 'Customer';
    doc.text(shippingName, col3, y3);
    y3 += 4;
    doc.setFont(undefined, 'normal');
    const shipAddr = doc.splitTextToSize(`${order.shippingAddress?.street || order.shippingAddress?.address || 'N/A'}`, colWidth);
    doc.text(shipAddr, col3, y3);
    y3 += (shipAddr.length * 4);
    doc.text(`${order.shippingAddress?.city || ''}, ${order.shippingAddress?.postalCode || order.shippingAddress?.pincode || ''}`, col3, y3);
    y3 += 4;
    doc.text(order.shippingAddress?.country || 'India', col3, y3);

    yPos = Math.max(y1, y2, y3) + 12;

    // Items Table
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Order Items', 15, yPos);
    yPos += 4;

    // Prepare table data
    const tableData = order.orderItems ? order.orderItems.map((item, index) => {
        return [
            index + 1,
            getOrderedItemDisplayName(item, `Product Item ${index + 1}`),
            item.qty || item.quantity,
            `Rs.${item.price.toLocaleString('en-IN')}`,
            `Rs.${((item.price) * (item.qty || item.quantity)).toLocaleString('en-IN')}`
        ];
    }) : (order.items || []).map((item, index) => [
        index + 1,
        item.name,
        item.qty || item.quantity,
        `Rs.${item.price.toLocaleString('en-IN')}`,
        `Rs.${(item.price * (item.qty || item.quantity)).toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [['#', 'Product Description', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [245, 245, 245],
            textColor: darkColor,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
            lineWidth: 0.1
        },
        bodyStyles: {
            fontSize: 8,
            textColor: darkColor,
            lineWidth: 0.1
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 'auto' },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 35 },
            4: { halign: 'right', cellWidth: 35 }
        },
        margin: { left: 15, right: 15 }
    });

    // Price Summary
    yPos = doc.lastAutoTable.finalY + 12;

    const summaryX = pageWidth - 95;
    const valueX = pageWidth - 20;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...lightColor);
    doc.text('Subtotal:', summaryX, yPos);
    doc.setTextColor(...darkColor);
    doc.text(`Rs.${(order.itemsPrice || order.totalPrice || order.total).toLocaleString('en-IN')}`, valueX, yPos, { align: 'right' });

    if (order.shippingPrice !== undefined) {
        yPos += 6;
        doc.setTextColor(...lightColor);
        doc.text('Shipping:', summaryX, yPos);
        doc.setTextColor(...(order.shippingPrice > 0 ? darkColor : [16, 185, 129]));
        doc.text(order.shippingPrice > 0 ? `Rs.${order.shippingPrice.toLocaleString('en-IN')}` : 'FREE', valueX, yPos, { align: 'right' });
    }

    if (order.taxPrice !== undefined) {
        yPos += 6;
        doc.setTextColor(...lightColor);
        doc.text('Tax:', summaryX, yPos);
        doc.setTextColor(...darkColor);
        doc.text(`Rs.${order.taxPrice.toLocaleString('en-IN')}`, valueX, yPos, { align: 'right' });
    }

    if (order.coupon?.discount && Number(order.coupon.discount) > 0) {
        yPos += 6;
        doc.setTextColor(...lightColor);
        doc.text(`Coupon${order.coupon.code ? ` (${order.coupon.code})` : ''}:`, summaryX, yPos);
        doc.setTextColor(16, 185, 129);
        doc.text(`-Rs.${Number(order.coupon.discount).toLocaleString('en-IN')}`, valueX, yPos, { align: 'right' });
    }

    if (isCodAdvancedPaid) {
        yPos += 6;
        doc.setTextColor(...lightColor);
        doc.text('COD Advance Paid Online:', summaryX, yPos);
        doc.setTextColor(16, 185, 129);
        doc.text(`-Rs.${codAdvancedAmount.toLocaleString('en-IN')}`, valueX, yPos, { align: 'right' });
    }

    yPos += 8;
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(summaryX - 5, yPos - 3, valueX, yPos - 3);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...darkColor);
    doc.text('Total Amount:', summaryX, yPos);
    doc.text(`Rs.${(isCodAdvancedPaid ? remainingCodBalance : (order.totalPrice || order.total)).toLocaleString('en-IN')}`, valueX, yPos, { align: 'right' });

    yPos += 12;

    // Payment Information
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...lightColor);
    doc.text('Payment Method:', summaryX, yPos);
    doc.setTextColor(...darkColor);
    doc.text(order.paymentMethod || order.payment?.method || 'COD', valueX, yPos, { align: 'right' });

    yPos += 6;
    doc.setTextColor(...lightColor);
    doc.text('Payment Status:', summaryX, yPos);
    const statusText = order.isPaid || order.payment?.status === 'Paid' ? 'Paid' : 'Pending';
    const statusColor = statusText === 'Paid' ? [16, 185, 129] : [245, 158, 11];
    doc.setTextColor(...statusColor);
    doc.text(statusText, valueX, yPos, { align: 'right' });

    if (isCodAdvancedPaid) {
        yPos += 6;
        doc.setTextColor(...lightColor);
        doc.text('Balance Collectable on Delivery:', summaryX, yPos);
        doc.setTextColor(...darkColor);
        doc.text(`Rs.${remainingCodBalance.toLocaleString('en-IN')}`, valueX, yPos, { align: 'right' });
    }

    // Footer
    yPos = pageHeight - 35;
    doc.setDrawColor(230, 230, 230);
    doc.line(15, yPos, pageWidth - 15, yPos);

    yPos += 8;
    doc.setFontSize(8);
    doc.setTextColor(...lightColor);
    doc.setFont(undefined, 'italic');
    doc.text(`Thank you for shopping with ${seller.name}!`, pageWidth / 2, yPos, { align: 'center' });

    yPos += 5;
    doc.text(`For any queries, contact us at support@${seller.name.toLowerCase().replace(/\s/g, '')}.com`, pageWidth / 2, yPos, { align: 'center' });

    yPos += 12;
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text('This is a computer-generated invoice and does not require a signature.', pageWidth / 2, yPos, { align: 'center' });

    // Save the PDF
    const fileName = `Invoice_${(order.displayId || order.id || order._id).toUpperCase()}.pdf`;
    doc.save(fileName);
};
