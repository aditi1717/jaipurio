import React, { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { getFulfillmentMode, getShippingProviderLabel, getTrackingIdentifier } from "../../../../utils/shippingProvider";
import { getOrderedItemDisplayName } from "../../../../utils/orderItemDisplay";

const getInvoiceNumber = (order) => {
  const savedInvoiceNumber = String(order?.invoiceNumber || "").trim();
  if (savedInvoiceNumber) return savedInvoiceNumber;
  return `INV-${String(order?.displayId || order?.id || order?._id || "").toUpperCase()}`;
};

const normalizeOrderStatus = (status = "") => {
  const value = String(status || "").trim();
  if (value === "Shipped") return "Dispatched";
  return value;
};

const getInvoicePaymentMode = (order) => {
  const normalizedPaymentMethod = String(order?.payment?.method || order?.paymentMethod || "")
    .trim()
    .toUpperCase();

  return normalizedPaymentMethod === "COD" ? "COD" : "PREPAID";
};

const getCodAdvancedSummary = (order) => {
  const codAdvancedAmount = Number(order?.codAdvancedAmount);
  const remainingCodBalance = Number(order?.remainingCodBalance);

  return {
    isCodAdvancedPaid: Boolean(order?.isCodAdvancedPaid) && Number.isFinite(codAdvancedAmount) && codAdvancedAmount > 0,
    codAdvancedAmount: Number.isFinite(codAdvancedAmount) ? codAdvancedAmount : 0,
    remainingCodBalance: Number.isFinite(remainingCodBalance) ? remainingCodBalance : 0,
  };
};

const BarcodeSvg = ({ value, height = 118 }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width: 1.25,
        height,
        margin: 0,
        displayValue: false,
        lineColor: "#000000",
        background: "transparent",
      });
    } catch (error) {
      console.error("Barcode generation failed:", error);
    }
  }, [value, height]);

  if (!value) return null;

  return <svg ref={svgRef} style={{ width: "100%", height: `${height}px`, display: "block" }} />;
};

const QrCodeImage = ({ value, size = 120 }) => {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;

    const generate = async () => {
      if (!value) {
        setSrc("");
        return;
      }

      try {
        const url = await QRCode.toDataURL(value, {
          width: size,
          margin: 0,
          errorCorrectionLevel: "M",
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        if (active) {
          setSrc(url);
        }
      } catch (error) {
        console.error("QR generation failed:", error);
        if (active) {
          setSrc("");
        }
      }
    };

    generate();

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) return null;

  return <img src={src} alt="Tracking QR" style={{ width: `${size}px`, height: `${size}px`, display: "block" }} />;
};

/* ============================================
   INVOICE DISPLAY
============================================ */

export const InvoiceDisplay = React.forwardRef(
  ({ order, item, items, settings: apiSettings, includeShippingLabel = true, trackingData = null }, ref) => {
    if (!order) return null;

    // Specific seller requirements - prioritize apiSettings from DB
    const settings = {
        sellerName: apiSettings?.sellerName || "IndianKart",
        sellerAddress: apiSettings?.sellerAddress || "123 E-com St, Digital City",
        gstNumber: apiSettings?.gstNumber || "123456789",
        panNumber: apiSettings?.panNumber || "LBCPS9976F",
        logoUrl: apiSettings?.logoUrl || "",
        signatureUrl: apiSettings?.signatureUrl || "",
        fssai: apiSettings?.fssai || "N/A"
    };

    const toNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const getQty = (lineItem) => {
      const rawQty = toNumber(lineItem?.qty ?? lineItem?.quantity ?? 1);
      return rawQty > 0 ? rawQty : 1;
    };

    const getPrice = (lineItem) => {
      const price = toNumber(lineItem?.price);
      return price >= 0 ? price : 0;
    };

    const isPathLike = (value) => {
      if (typeof value !== "string") return false;
      const v = value.trim();
      if (!v) return false;
      return (
        /^https?:\/\//i.test(v) ||
        /^([a-zA-Z]:)?[\\/]/.test(v) ||
        /[\\/].+\.(jpg|jpeg|png|webp|gif|svg|avif)(\?.*)?$/i.test(v)
      );
    };

    const getSafeName = (lineItem, index) => {
      const candidates = [lineItem?.name, lineItem?.title, lineItem?.productName];
      const validName = candidates.find(
        (candidate) => typeof candidate === "string" && candidate.trim() && !isPathLike(candidate)
      );
      return validName?.trim() || `Product Item ${index + 1}`;
    };

    const getDisplayTitle = (lineItem, index) => {
      const baseName = getOrderedItemDisplayName(lineItem, getSafeName(lineItem, index));
      const detailParts = [];

      const skuCandidates = [lineItem?.sku, lineItem?.skuId, lineItem?.productId];
      const skuValue = skuCandidates.find((candidate) => typeof candidate === "string" && candidate.trim());

      if (skuValue) {
        detailParts.push(`SKU: ${skuValue.trim()}`);
      }

      return detailParts.length > 0
        ? `${baseName} (${detailParts.join(" | ")})`
        : baseName;
    };

    const format = (n) => toNumber(n).toFixed(2);
    const fulfillmentMode = getFulfillmentMode(order);
    const isCourierMode = fulfillmentMode === "delhivery" || fulfillmentMode === "ekart";
    const trackingId = getTrackingIdentifier(order, fulfillmentMode);
    const providerLabel = getShippingProviderLabel(fulfillmentMode);
    const liveTrackingStatus = String(trackingData?.mappedCurrentStep || trackingData?.currentStatus || "").trim();
    const manualStatus = normalizeOrderStatus(order?.status || "");
    const effectiveShipmentStatus = liveTrackingStatus || manualStatus || "Pending";
    const shipmentSyncedAt = order?.delhivery?.syncedAt || order?.ekart?.syncedAt || trackingData?.lastUpdatedAt || null;
    const labelOrderId = String(order.displayId || order.id || order._id || "").trim();
    const customerName = order.shippingAddress?.name || order.address?.name || order.user?.name || "Customer Name";
    const customerStreet = order.address?.line || order.shippingAddress?.address || order.shippingAddress?.street || "Address Not Available";
    const customerCity = order.address?.city || order.shippingAddress?.city || "N/A";
    const customerState = order.address?.state || order.shippingAddress?.state || "N/A";
    const customerPin = order.address?.pincode || order.shippingAddress?.pincode || order.shippingAddress?.postalCode || "N/A";
    const awbDisplayValue = trackingId || labelOrderId;
    const appBaseUrl = (
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_APP_URL)
      || (typeof window !== "undefined" && window.location?.origin)
      || ""
    ).replace(/\/$/, "");
    const delhiveryRedirectUrl = trackingId && appBaseUrl
      ? `${appBaseUrl}/r/${encodeURIComponent(fulfillmentMode)}/${encodeURIComponent(trackingId)}`
      : "";
    const barcodeValue = delhiveryRedirectUrl || awbDisplayValue;
    const qrPayload = delhiveryRedirectUrl || [
      `Order ID: ${labelOrderId}`,
      awbDisplayValue ? `Tracking ID: ${awbDisplayValue}` : "",
      customerName ? `Customer: ${customerName}` : "",
      effectiveShipmentStatus ? `Status: ${effectiveShipmentStatus}` : "",
      `Address: ${customerStreet}, ${customerCity}, ${customerState} - ${customerPin}`,
    ].filter(Boolean).join("\n");

    const formatShortDate = (value) => {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return "";
      return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" });
    };

    // Robust list selection: items prop > item prop > order.items/order.orderItems
    const rawList = (items && items.length > 0)
      ? items
      : (item ? [item] : (order?.items || order?.orderItems || []));

    const list = rawList.map((lineItem, index) => ({
      ...lineItem,
      safeName: getDisplayTitle(lineItem, index),
      safeQty: getQty(lineItem),
      safePrice: getPrice(lineItem),
    }));

    const totalQty = list.reduce((sum, lineItem) => sum + lineItem.safeQty, 0);
    const subtotal = list.reduce((sum, lineItem) => sum + (lineItem.safePrice * lineItem.safeQty), 0);
    const handlingFee = 0.00;
    const couponCode = order?.coupon?.code || "";
    const couponDiscount = item ? 0 : toNumber(order?.coupon?.discount);
    const orderGrandTotal = toNumber(order?.totalPrice ?? order?.total ?? order?.itemsPrice ?? subtotal);
    const totalAmount = (item ? subtotal : orderGrandTotal) + handlingFee;
    const printedAt = new Date();
    const invoicePaymentMode = getInvoicePaymentMode(order);
    const { isCodAdvancedPaid, codAdvancedAmount, remainingCodBalance } = getCodAdvancedSummary(order);

    return (
      <div ref={ref} className="invoice-root">
        <style>{`
          .invoice-root {
            padding: 30px 40px;
            background: white;
            color: black;
            font-family: sans-serif;
            font-size: 9.5px;
            max-width: 195mm;
            margin: 0 auto;
            box-sizing: border-box;
          }
          .label {
            border: 1px solid black;
            width: 100%;
            max-width: 500px;
            margin: 0 auto 20px auto;
          }
          .label table {
            width: 100%;
            border-collapse: collapse;
          }
          .label th, .label td {
            border: 1px solid black;
            padding: 3px 5px;
            text-align: left;
            vertical-align: top;
          }
          .label .brand {
            font-size: 15px;
            font-weight: bold;
          }
          .label .brand-block {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .label .logo-inline {
            display: inline-block;
            max-width: 110px;
            max-height: 28px;
            width: auto;
            height: auto;
            object-fit: contain;
            vertical-align: middle;
          }
          .label .b2 {
            width: 35px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid black;
          }
          .label .media-cell {
            padding: 0;
          }
          .label .barcode-wrap {
            height: 138px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 8px 4px;
          }
          .label .barcode-meta {
            font-size: 8px;
            font-weight: bold;
            text-align: center;
            letter-spacing: 0.08em;
          }
          .label .qr-wrap {
            min-height: 138px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 6px;
            padding: 8px;
          }
          .label .mini-note {
            font-size: 7px;
            line-height: 1.25;
          }
          .label-footer {
            display: flex;
            justify-content: space-between;
            padding: 3px 5px;
            font-size: 8px;
            font-weight: bold;
          }
          .dashed {
            border: none;
            border-top: 1px dashed #999;
            margin: 20px 0;
            width: 100%;
          }
          .tax-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            border-top: 2px solid black;
            padding-top: 8px;
          }
          .tax-header-item {
            flex: 1;
            padding-right: 5px;
          }
          .addr-grid {
            display: grid;
            grid-template-cols: 1.2fr 1fr 1.1fr;
            gap: 15px;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          .addr-block {
            line-height: 1.3;
          }
          .addr-title {
            font-weight: bold;
            font-size: 10px;
            margin-bottom: 3px;
            display: block;
            text-transform: uppercase;
            color: #444;
          }
          .tax-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5px;
            border: 1px solid #ccc;
          }
          .tax-table th, .tax-table td {
            border: 1px solid #ccc;
            padding: 5px 4px;
            text-align: left;
          }
          .tax-table th {
            font-weight: bold;
            background: #fcfcfc;
          }
          .invoice-barcode-block {
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 16px;
          }
          .invoice-barcode {
            width: 230px;
            max-width: 100%;
          }
          .invoice-barcode-note {
            font-size: 7px;
            line-height: 1.3;
            text-align: right;
          }
          .text-right { text-align: right !important; }
          .text-center { text-align: center !important; }
          .font-bold { font-weight: bold; }
          
          @media print {
            @page { 
              size: A4; 
              margin: 10mm; 
            }
            body { -webkit-print-color-adjust: exact; padding: 0; margin: 0; overflow: visible !important; }
            .invoice-root { 
              padding: 5mm 0;
              max-width: none;
              overflow: visible !important;
            }
            .dashed { margin: 15px 0; }
          }
        `}</style>

        {includeShippingLabel && (
          <>
        {/* ================= SHIPPING LABEL ================= */}
        <div className="label">
          <table>
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center", fontSize: "14px" }}>STD</th>
                <th>
                  <div className="brand-block">
                    {settings.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt="Store Logo"
                        className="logo-inline"
                        loading="eager"
                        crossOrigin="anonymous"
                      />
                    )}
                    <div style={{ fontSize: "8px" }}>IndiaKart</div>
                  </div>
                  <div style={{ fontSize: "10px", fontWeight: "bold" }}>{order.displayId || order.id || order._id}</div>
                </th>
                <th style={{ width: "100px" }}>
                  <div style={{ fontSize: "8px" }}>â†‘SURFACE</div>
                  <div style={{ fontSize: "10px", fontWeight: "bold" }}>{invoicePaymentMode}</div>
                </th>
                <th style={{ width: "30px", fontSize: "18px", textAlign: "center" }}>E</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="4" style={{ padding: "6px 5px" }}>
                   <div style={{ fontSize: "8px", marginBottom: "2px" }}>Ordered through</div>
                   <div className="brand-block">
                     {settings.logoUrl && (
                       <img
                         src={settings.logoUrl}
                         alt="Store Logo"
                         className="logo-inline"
                         loading="eager"
                         crossOrigin="anonymous"
                       />
                     )}
                     <div className="brand" style={{ fontSize: "13px" }}>IndianKart</div>
                   </div>
                </td>
              </tr>
              <tr>
                <td className="media-cell" style={{ width: "130px" }}>
                  <div className="qr-wrap">
                    <QrCodeImage value={qrPayload} size={112} />
                    <div className="mini-note" style={{ fontWeight: "bold", textAlign: "center" }}>
                      {isCourierMode && trackingId ? `${getShippingProviderLabel(fulfillmentMode)} Tracking: ${trackingId}` : `Order ID: ${labelOrderId}`}
                    </div>
                  </div>
                </td>
                <td colSpan="3" className="media-cell">
                  <div className="barcode-wrap">
                    <div style={{ width: "230px" }}>
                      <BarcodeSvg value={barcodeValue} height={96} />
                    </div>
                    <div className="barcode-meta">
                      {awbDisplayValue
                        ? (isCourierMode && trackingId ? `Open Tracking | ${awbDisplayValue}` : `AWB No. ${awbDisplayValue}`)
                        : "TRACKING ID"}
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td colSpan="4" className="addr">
                  <div style={{ marginBottom: "3px" }}><b>Shipping/Customer address:</b></div>
                  <div>Name: <b>{customerName}</b></div>
                  <div style={{ maxWidth: "250px" }}>{customerStreet}</div>
                  <div>{customerCity}, {customerState} - <b>{customerPin}</b></div>
                </td>
              </tr>
              <tr style={{ height: "35px" }}>
                <td colSpan="2" style={{ borderRight: "1px solid black" }}>
                  <div><b>HBD:</b> {formatShortDate(order.date || order.createdAt) || "N/A"}</div>
                  <div><b>CPD:</b> {formatShortDate(shipmentSyncedAt || printedAt) || "N/A"}</div>
                  <div className="mini-note" style={{ marginTop: "2px" }}>
                    <b>{isCourierMode ? `${providerLabel} Status:` : "Manual Status:"}</b> {effectiveShipmentStatus}
                  </div>
                </td>
                <td colSpan="2">
                  <div style={{ fontSize: "8px" }}>Sold By:<b>{settings.sellerName}</b>, {settings.sellerAddress}</div>
                </td>
              </tr>
              <tr>
                <td colSpan="4">
                  <b>GSTIN: {settings.gstNumber}</b>
                </td>
              </tr>
              <tr>
                <th className="text-center" style={{ width: "20px" }}>#</th>
                <th style={{ fontSize: "8px" }}><b>SKU ID | Description</b></th>
                <th className="text-center" style={{ width: "40px" }}><b>QTY</b></th>
                <th style={{ width: "40px" }}></th>
              </tr>
              {list.map((i, idx) => (
                <tr key={idx} style={{ height: "45px" }}>
                  <td className="text-center">{idx + 1}</td>
                  <td><div className="font-bold">{i.safeName}</div></td>
                  <td className="text-center font-bold">{i.safeQty}</td>
                  <td></td>
                </tr>
              ))}
              <tr>
                <td colSpan="3" style={{ padding: "6px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "bold" }}>FMPP{String(order.displayId || order.id || order._id).slice(0, 8).toUpperCase()}</div>
                </td>
                <td className="b2">B2</td>
              </tr>
            </tbody>
          </table>
          <div className="label-footer">
            <span>Not for resale.</span>
            <span>Printed at {printedAt.getHours()}{String(printedAt.getMinutes()).padStart(2, '0')} hrs, {printedAt.toLocaleDateString("en-IN", { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
          </div>
        </div>

        <hr className="dashed" />
          </>
        )}

        {/* ================= TAX INVOICE ================= */}
        <div className="tax">
          <div className="tax-header">
            <div className="tax-header-item">
              {settings.logoUrl && (
                  <img src={settings.logoUrl} alt="Store Logo" loading="eager" crossOrigin="anonymous" style={{ height: "40px", marginBottom: "5px", objectFit: "contain", maxWidth: "120px" }} />
              )}
              <h2 style={{ fontSize: "12px", margin: "0 0 3px 0" }}>Tax Invoice</h2>
            </div>
            <div className="tax-header-item">
              Order Id: <b>{order.displayId || order.id || order._id}</b><br />
              <span style={{ fontSize: "7px" }}>{new Date(order.date || order.createdAt).toLocaleString()}</span>
            </div>
            <div className="tax-header-item">
              Invoice: <b>{getInvoiceNumber(order)}</b><br />
              <span style={{ fontSize: "7px" }}>{new Date().toLocaleString()}</span>
            </div>
            <div className="tax-header-item text-right">
              <div>Fulfillment: {providerLabel}</div>
              <div>Status: {effectiveShipmentStatus}</div>
              GST: {settings.gstNumber}<br />
              PAN: {settings.panNumber}
            </div>
          </div>

          <div className="addr-grid">
            <div className="addr-block">
              <span className="addr-title">Sold By</span>
              <div className="font-bold">{settings.sellerName}</div>
              <div>{settings.sellerAddress}</div>
              <div style={{ marginTop: "3px" }}>GST: {settings.gstNumber}</div>
            </div>
            <div className="addr-block">
              <span className="addr-title">Billing Address</span>
              <div className="font-bold">{order.shippingAddress?.name || order.address?.name || order.user?.name || 'Customer'}</div>
              {order.retailerDetails?.isRetailer && (
                <>
                  <div><b>Shop:</b> {order.retailerDetails?.shopName || 'N/A'}</div>
                  <div><b>GSTIN:</b> {order.retailerDetails?.gstNumber || 'N/A'}</div>
                </>
              )}
              <div>{order.address?.line || order.shippingAddress?.address || order.shippingAddress?.street || 'N/A'}</div>
              <div>{order.address?.city || order.shippingAddress?.city || 'N/A'}, {order.address?.state || order.shippingAddress?.state || 'N/A'} - {order.address?.pincode || order.shippingAddress?.pincode || order.shippingAddress?.postalCode || ''}</div>
            </div>
            <div className="addr-block">
              <span className="addr-title">Shipping Address</span>
              <div className="font-bold">{order.shippingAddress?.name || order.address?.name || order.user?.name || 'Customer'}</div>
              <div>{order.address?.line || order.shippingAddress?.address || order.shippingAddress?.street || 'N/A'}</div>
              <div>{order.address?.city || order.shippingAddress?.city || 'N/A'}, {order.address?.state || order.shippingAddress?.state || 'N/A'} - {order.address?.pincode || order.shippingAddress?.pincode || order.shippingAddress?.postalCode || ''}</div>
            </div>
          </div>

          <table className="tax-table">
            <thead>
              <tr style={{ background: "#eee" }}>
                <th>Product</th>
                <th style={{ width: "150px" }}>Description</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Disc.</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">IGST</th>
                <th className="text-right">CESS</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i, idx) => {
                const gross = i.safePrice * i.safeQty;
                const taxable = gross / 1.18;
                const tax = gross - taxable;

                return (
                  <tr key={idx}>
                    <td>
                      <div><b>{i.safeName}</b></div>
                      {i.serialNumber && <div style={{ fontSize: "7px", color: "#666" }}>IMEI/SN: {i.serialNumber}</div>}
                    </td>
                    <td>HSN: 90029000 | 18.00% | 0%</td>
                    <td className="text-center">{i.safeQty}</td>
                    <td className="text-right">{format(gross)}</td>
                    <td className="text-right">0.00</td>
                    <td className="text-right">{format(taxable)}</td>
                    <td className="text-right">{format(tax)}</td>
                    <td className="text-right">0.00</td>
                    <td className="text-right font-bold">{format(gross)}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan="2"><b>Handling Fee</b></td>
                <td className="text-center">1</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
                <td className="text-right">0.00</td>
              </tr>
              {couponDiscount > 0 && (
                <tr>
                  <td colSpan="8" className="text-right"><b>Coupon Applied{couponCode ? ` (${couponCode})` : ""}</b></td>
                  <td className="text-right" style={{ color: "#0f9d58" }}>-Rs.{format(couponDiscount)}</td>
                </tr>
              )}
              {isCodAdvancedPaid && (
                <tr>
                  <td colSpan="8" className="text-right"><b>COD Advance Paid Online</b></td>
                  <td className="text-right" style={{ color: "#0f9d58" }}>-Rs.{format(codAdvancedAmount)}</td>
                </tr>
              )}
              <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                <td colSpan="2">TOTAL QTY: {totalQty}</td>
                <td colSpan="6" className="text-right">
                  {isCodAdvancedPaid ? "TOTAL AMOUNT DUE / COLLECTABLE:" : "TOTAL PRICE:"}
                </td>
                <td className="text-right">
                  Rs.{format(isCodAdvancedPaid ? remainingCodBalance : totalAmount)}
                </td>
              </tr>
              {isCodAdvancedPaid && (
                <tr style={{ background: "#fff8e1", fontWeight: "bold" }}>
                  <td colSpan="8" className="text-right">BALANCE COD COLLECTABLE AT DELIVERY:</td>
                  <td className="text-right">Rs.{format(remainingCodBalance)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="text-right" style={{ fontSize: "7px", marginTop: "2px", fontStyle: "italic", color: "#666" }}>
             All values are in INR
          </div>

              <div className="invoice-barcode-block">
            <div className="invoice-barcode">
              <BarcodeSvg value={barcodeValue} height={46} />
              <div style={{ fontSize: "8px", fontWeight: "bold", marginTop: "3px" }}>
                {isCourierMode && trackingId ? `${getShippingProviderLabel(fulfillmentMode)} Tracking: ${awbDisplayValue}` : `Order ID: ${awbDisplayValue}`}
              </div>
            </div>
            <div className="invoice-barcode-note">
              <div><b>Scan to open tracking</b></div>
              <div>{isCourierMode && trackingId ? `Redirects to ${getShippingProviderLabel(fulfillmentMode)} tracking` : "Order reference barcode"}</div>
            </div>
          </div>

          <div style={{ marginTop: "25px", display: "flex", justifyBetween: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: "8px", lineHeight: "1.5", color: "#444" }}>
              <div style={{ marginBottom: "10px" }}>
                <b>Declaration</b><br />
                The goods sold are intended for end user consumption and not for resale.
              </div>
              <b>Seller Registered Address:</b><br />
              {settings.sellerName}, {settings.sellerAddress}<br />
              FSSAI: {settings.fssai || 'N/A'}
            </div>
            <div className="text-center" style={{ marginLeft: "auto", minWidth: "150px" }}>
              {settings.signatureUrl && (
                <img 
                  src={settings.signatureUrl} 
                  alt="Signature" 
                  style={{ height: "60px", width: "auto", margin: "0 auto 5px auto", display: "block", objectFit: "contain" }} 
                />
              )}
              <div style={{ borderTop: "1px solid black", paddingTop: "5px", fontSize: "9px", fontWeight: "bold", marginTop: "5px" }}>
                Authorized Signature
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", fontSize: "9px", fontWeight: "bold", borderTop: "1px solid #eee", paddingTop: "10px" }}>
             <span>E. & O.E.</span>
             <span>Ordered Through IndianKart <span style={{ border: "1px solid black", padding: "0 1px", transform: "scaleX(-1)", display: "inline-block", fontSize: "8px" }}>f</span></span>
          </div>
        </div>
      </div>
    );
  }
);

/* ============================================
   INVOICE GENERATOR WRAPPER
============================================ */

const InvoiceGenerator = ({ order, item, items, settings, customTrigger, includeShippingLabel = true, trackingData = null }) => {
  const componentRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  if (!order) return null;

  const trigger = customTrigger ? (
    React.cloneElement(customTrigger, { 
      onClick: (e) => {
        e.preventDefault();
        handlePrint();
      }
    })
  ) : (
    <button
      onClick={handlePrint}
      className="bg-black text-white px-4 py-2 rounded font-bold text-sm hover:bg-gray-800 transition-colors"
    >
      Print Invoice
    </button>
  );

  return (
    <>
      <div style={{ display: "none" }}>
        <InvoiceDisplay
          ref={componentRef}
          order={order}
          item={item}
          items={items}
          settings={settings || {}}
          includeShippingLabel={includeShippingLabel}
          trackingData={trackingData}
        />
      </div>
      {trigger}
    </>
  );
};

/* ============================================
   BULK INVOICE GENERATOR
============================================ */

export const BulkInvoiceGenerator = ({ orders, settings, customTrigger, includeShippingLabel = true, trackingData = null }) => {
  const componentRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  if (!orders || orders.length === 0) return null;

  const trigger = customTrigger ? (
    React.cloneElement(customTrigger, { 
      onClick: (e) => {
        e.preventDefault();
        handlePrint();
      }
    })
  ) : (
    <button
      onClick={handlePrint}
      className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
    >
      Print {orders.length} Invoices
    </button>
  );

  return (
    <>
      <div style={{ display: "none" }}>
        <div ref={componentRef}>
          {orders.map((order) => (
            <div key={order.id || order._id} style={{ pageBreakAfter: "always" }}>
              <InvoiceDisplay
                order={order}
                items={order.items || order.orderItems}
                settings={settings || {}}
                includeShippingLabel={includeShippingLabel}
                trackingData={trackingData}
              />
            </div>
          ))}
        </div>
      </div>
      {trigger}
    </>
  );
};

export default InvoiceGenerator;
