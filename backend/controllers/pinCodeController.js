import PinCode from '../models/PinCode.js';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { promises as fs } from 'node:fs';

const VALID_DELIVERY_UNITS = new Set(['minutes', 'hours', 'days']);
const HEADER_ALIASES = {
    code: ['pincode', 'pin code', 'postal code', 'postalcode', 'zip', 'zipcode', 'code', 'pin'],
    isCOD: ['iscod', 'cod', 'cashondelivery', 'cash on delivery'],
    deliveryTime: ['deliverytime', 'delivery time', 'eta', 'estimated time', 'tat', 'sla'],
    deliveryUnit: ['deliveryunit', 'delivery unit', 'eta unit', 'time unit', 'tat unit', 'sla unit']
};

const normalizeKey = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const normalizePinCode = (value = '') => String(value).trim();

const normalizeBoolean = (value, defaultValue = true) => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return defaultValue;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['false', 'no', '0', 'n', 'off'].includes(normalized)) return false;
    if (['true', 'yes', '1', 'y', 'on'].includes(normalized)) return true;
    return defaultValue;
};

const normalizeDeliveryTime = (value, defaultValue = 3) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

const normalizeDeliveryUnit = (value, defaultValue = 'days') => {
    const normalized = String(value || '').trim().toLowerCase();
    return VALID_DELIVERY_UNITS.has(normalized) ? normalized : defaultValue;
};

const getValueFromRow = (row, possibleNames) => {
    const normalizedNames = new Set(possibleNames.map(normalizeKey));
    for (const [key, value] of Object.entries(row)) {
        if (normalizedNames.has(normalizeKey(key))) {
            return value;
        }
    }
    return null;
};

const extractWorksheetRows = (worksheet) => {
    const headerRow = worksheet.getRow(1);
    const headers = (headerRow.values || [])
        .slice(1)
        .map((header) => String(header || '').trim());

    if (headers.length === 0 || headers.every((header) => !header)) {
        throw new Error('Header row is missing in uploaded file');
    }

    const dataRows = [];
    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);
        const values = (row.values || []).slice(1);
        const rowObject = {};

        headers.forEach((header, index) => {
            if (header) {
                rowObject[header] = values[index];
            }
        });

        const hasData = Object.values(rowObject).some((value) => (
            value !== null && value !== undefined && String(value).trim() !== ''
        ));

        if (hasData) {
            dataRows.push({ rowNumber: rowIndex, row: rowObject });
        }
    }

    return dataRows;
};

const buildImportPayload = (row) => {
    const code = normalizePinCode(getValueFromRow(row, HEADER_ALIASES.code));

    return {
        code,
        isCOD: normalizeBoolean(getValueFromRow(row, HEADER_ALIASES.isCOD), true),
        deliveryTime: normalizeDeliveryTime(getValueFromRow(row, HEADER_ALIASES.deliveryTime), 3),
        deliveryUnit: normalizeDeliveryUnit(getValueFromRow(row, HEADER_ALIASES.deliveryUnit), 'days')
    };
};

// @desc    Add a new serviceable PIN code
// @route   POST /api/pincodes
// @access  Private/Admin
const addPinCode = async (req, res) => {
    const { code, isCOD, deliveryTime, deliveryUnit, demoEnabled } = req.body;

    // Validate inputs
    if (!code) {
        return res.status(400).json({ message: 'Please provide pincode' });
    }

    const pinCodeExists = await PinCode.findOne({ code });

    if (pinCodeExists) {
        return res.status(400).json({ message: 'PIN Code already exists' });
    }

    const pinCode = await PinCode.create({
        code,
        isCOD: isCOD !== undefined ? isCOD : true,
        deliveryTime: Number(deliveryTime) > 0 ? Number(deliveryTime) : 3,
        deliveryUnit: ['minutes', 'hours', 'days'].includes(String(deliveryUnit || '').toLowerCase())
            ? String(deliveryUnit).toLowerCase()
            : 'days',
        demoEnabled: demoEnabled === true || String(demoEnabled).toLowerCase() === 'true'
    });

    if (pinCode) {
        res.status(201).json(pinCode);
    } else {
        res.status(400).json({ message: 'Invalid data' });
    }
};

// @desc    Get all PIN codes
// @route   GET /api/pincodes
// @access  Private/Admin
const getPinCodes = async (req, res) => {
    const hasPaginationParams = req.query.page || req.query.limit;

    if (!hasPaginationParams) {
        const pinCodes = await PinCode.find({}).sort({ createdAt: -1 }).lean();
        return res.json(pinCodes);
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const [pinCodes, totalCount] = await Promise.all([
        PinCode.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        PinCode.countDocuments({})
    ]);

    res.json({
        items: pinCodes,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.max(Math.ceil(totalCount / limit), 1)
        }
    });
};

// @desc    Delete a PIN code
// @route   DELETE /api/pincodes/:id
// @access  Private/Admin
const deletePinCode = async (req, res) => {
    const pinCode = await PinCode.findById(req.params.id);

    if (pinCode) {
        await pinCode.deleteOne();
        res.json({ message: 'PIN Code removed' });
    } else {
        res.status(404).json({ message: 'PIN Code not found' });
    }
};

// @desc    Check PIN code availability
// @route   GET /api/pincodes/check/:code
// @access  Public
const checkPinCode = async (req, res) => {
    const { code } = req.params;
    try {
        const pinCode = await PinCode.findOne({ code: code.trim() });

        if (pinCode && pinCode.isActive) {
            res.json({
                isServiceable: true,
                isCOD: pinCode.isCOD,
                deliveryTime: pinCode.deliveryTime,
                deliveryUnit: pinCode.deliveryUnit,
                message: 'Deliverable to this location'
            });
        } else {
            res.json({
                isServiceable: false,
                message: 'Not deliverable to this location'
            });
        }
    } catch (error) {
        console.error(`Error checking pincode:`, error);
        res.status(500).json({ message: 'Error checking pincode' });
    }
};

// @desc    Update a PIN code
// @route   PUT /api/pincodes/:id
// @access  Private/Admin
const updatePinCode = async (req, res) => {
    const { code, isCOD, deliveryTime, deliveryUnit, demoEnabled } = req.body;
    const pinCode = await PinCode.findById(req.params.id);

    if (pinCode) {
        pinCode.code = code || pinCode.code;
        if (isCOD !== undefined) pinCode.isCOD = isCOD;
        if (deliveryTime !== undefined && Number(deliveryTime) > 0) pinCode.deliveryTime = Number(deliveryTime);
        if (deliveryUnit !== undefined && ['minutes', 'hours', 'days'].includes(String(deliveryUnit).toLowerCase())) {
            pinCode.deliveryUnit = String(deliveryUnit).toLowerCase();
        }
        if (demoEnabled !== undefined) {
            pinCode.demoEnabled = demoEnabled === true || String(demoEnabled).toLowerCase() === 'true';
        }

        const updatedPinCode = await pinCode.save();
        res.json(updatedPinCode);
    } else {
        res.status(404).json({ message: 'PIN Code not found' });
    }
};

// @desc    Export all PIN codes as CSV
// @route   GET /api/pincodes/export
// @access  Private/Admin
const exportPinCodes = async (req, res) => {
    try {
        const pinCodes = await PinCode.find({})
            .sort({ code: 1 })
            .select('code isCOD deliveryTime deliveryUnit')
            .lean();

        const escapeCsvValue = (value) => {
            const stringValue = String(value ?? '');
            if (/[",\n]/.test(stringValue)) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        const rows = [
            ['Pincode', 'isCOD', 'deliveryTime', 'deliveryUnit'],
            ...pinCodes.map((pinCode) => ([
                pinCode.code,
                pinCode.isCOD !== false,
                pinCode.deliveryTime ?? 3,
                pinCode.deliveryUnit || 'days'
            ]))
        ];

        const csvContent = rows
            .map((row) => row.map(escapeCsvValue).join(','))
            .join('\n');

        const dateStamp = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="indiakart_pincodes_${dateStamp}.csv"`);
        res.status(200).send(csvContent);
    } catch (error) {
        console.error('Export PIN codes error:', error);
        res.status(500).json({ message: 'Failed to export PIN codes', error: error.message });
    }
};

// @desc    Bulk import PIN codes from Excel
// @route   POST /api/pincodes/bulk-import
// @access  Private/Admin
const bulkImportPinCodes = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a .xlsx or .csv file' });
        }
        if (!req.file?.path) {
            return res.status(400).json({ message: 'Uploaded file could not be read' });
        }

        const fileBuffer = await fs.readFile(req.file.path);
        if (fileBuffer.length === 0) {
            return res.status(400).json({ message: 'Uploaded file is empty' });
        }

        const fileName = (req.file.originalname || '').toLowerCase();
        const isCSV = fileName.endsWith('.csv');
        const isXLSX = fileName.endsWith('.xlsx');
        const isXLS = fileName.endsWith('.xls');

        if (isXLS) {
            return res.status(400).json({
                message: 'The .xls format is not supported. Please upload .xlsx or .csv'
            });
        }

        if (!isCSV && !isXLSX) {
            return res.status(400).json({
                message: 'Unsupported file format. Please upload .xlsx or .csv'
            });
        }

        const workbook = new ExcelJS.Workbook();

        try {
            if (isCSV) {
                await workbook.csv.read(Readable.from(fileBuffer), {
                    parserOptions: {
                        trim: true,
                        skipEmptyLines: true
                    }
                });
            } else {
                await workbook.xlsx.load(fileBuffer);
            }
        } catch (parseError) {
            console.error('Parse error:', parseError);
            return res.status(400).json({ message: 'Failed to parse file', error: parseError.message });
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            return res.status(400).json({ message: 'No worksheet found in uploaded file' });
        }

        let dataRows;
        try {
            dataRows = extractWorksheetRows(worksheet);
        } catch (validationError) {
            return res.status(400).json({ message: validationError.message });
        }

        if (dataRows.length === 0) {
            return res.status(400).json({ message: 'Excel/CSV file has no data rows' });
        }

        const results = {
            successful: 0,
            updated: 0,
            skipped: 0,
            errors: [],
            total: dataRows.length
        };

        const seenCodesInFile = new Set();
        const validRows = [];

        for (const { rowNumber, row } of dataRows) {
            const payload = buildImportPayload(row);

            if (!payload.code) {
                results.errors.push(`Row ${rowNumber}: Missing pincode`);
                continue;
            }

            if (seenCodesInFile.has(payload.code)) {
                results.skipped++;
                results.errors.push(`Row ${rowNumber}: Duplicate pincode ${payload.code} in uploaded file`);
                continue;
            }

            seenCodesInFile.add(payload.code);
            validRows.push({ rowNumber, payload });
        }

        if (validRows.length === 0) {
            return res.status(400).json({
                message: 'No valid rows found in uploaded file',
                results
            });
        }

        const existingPinCodes = await PinCode.find({ code: { $in: validRows.map(({ payload }) => payload.code) } })
            .select('_id code isCOD deliveryTime deliveryUnit')
            .lean();
        const existingPinCodeMap = new Map(
            existingPinCodes.map((pinCode) => [pinCode.code, pinCode])
        );

        const documentsToInsert = [];
        const bulkUpdates = [];

        for (const { rowNumber, payload } of validRows) {
            const existingPinCode = existingPinCodeMap.get(payload.code);

            if (existingPinCode) {
                const hasChanges =
                    existingPinCode.isCOD !== payload.isCOD ||
                    existingPinCode.deliveryTime !== payload.deliveryTime ||
                    existingPinCode.deliveryUnit !== payload.deliveryUnit;

                if (!hasChanges) {
                    results.skipped++;
                } else {
                    bulkUpdates.push({
                        updateOne: {
                            filter: { _id: existingPinCode._id },
                            update: {
                                $set: {
                                    isCOD: payload.isCOD,
                                    deliveryTime: payload.deliveryTime,
                                    deliveryUnit: payload.deliveryUnit,
                                    updatedAt: new Date()
                                }
                            }
                        }
                    });
                }

                continue;
            }

            documentsToInsert.push({ rowNumber, ...payload });
        }

        if (bulkUpdates.length > 0) {
            try {
                const updateResult = await PinCode.bulkWrite(bulkUpdates, { ordered: false });
                results.updated += updateResult.modifiedCount || 0;
            } catch (error) {
                console.error('Bulk update error:', error);
                results.errors.push(`Failed to update some existing pincodes: ${error.message}`);
            }
        }

        if (documentsToInsert.length > 0) {
            try {
                const insertResult = await PinCode.insertMany(
                    documentsToInsert.map(({ rowNumber, ...document }) => document),
                    { ordered: false }
                );
                results.successful += insertResult.length;
            } catch (error) {
                const writeErrors = error?.writeErrors || [];
                const failedIndexes = new Set();

                for (const writeError of writeErrors) {
                    failedIndexes.add(writeError.index);
                    const failedRow = documentsToInsert[writeError.index];
                    const reason = writeError.errmsg || writeError.message || 'Insert failed';
                    results.errors.push(`Row ${failedRow?.rowNumber || 'unknown'}: ${reason}`);
                    results.skipped++;
                }

                const succeededCount = documentsToInsert.length - failedIndexes.size;
                results.successful += Math.max(succeededCount, 0);

                if (writeErrors.length === 0) {
                    throw error;
                }
            }
        }

        res.json({
            message: 'Bulk import completed',
            results,
            meta: {
                fileName: req.file.originalname,
                fileSize: req.file.size,
                processedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({ message: 'Error processing Excel file', error: error.message });
    } finally {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
    }
};

export {
    addPinCode,
    getPinCodes,
    deletePinCode,
    checkPinCode,
    exportPinCodes,
    bulkImportPinCodes,
    updatePinCode
};
