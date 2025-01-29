const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
const pdfParse = require('pdf-parse');
const { Document, Packer, Paragraph } = require('docx');
const app = express();
const PORT = 3000;

// Directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CONVERTED_DIR = path.join(__dirname, 'converted');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR);

// Configure multer for file uploads
const upload = multer({ dest: UPLOADS_DIR });

// Convert PDF to Word
app.post('/convert-pdf-to-word', upload.single('file'), async (req, res) => {
    if (!req.file || path.extname(req.file.originalname).toLowerCase() !== '.pdf') {
        return res.status(400).send('Please upload a valid PDF file.');
    }

    const pdfFilePath = req.file.path;
    const wordOutputPath = path.join(CONVERTED_DIR, `${req.file.filename}.docx`);

    try {
        const pdfBuffer = fs.readFileSync(pdfFilePath);
        const pdfData = await pdfParse(pdfBuffer);

        if (!pdfData.text || pdfData.text.trim() === '') {
            throw new Error('Failed to extract text from PDF. The file may contain images or unsupported content.');
        }

        const paragraphs = pdfData.text.split('\n').filter(line => line.trim().length > 0).map(line => new Paragraph(line));

        if (paragraphs.length === 0) {
            throw new Error('No valid content extracted from PDF.');
        }

        const doc = new Document({
            sections: [{ children: paragraphs }],
        });

        const wordBuffer = await Packer.toBuffer(doc);
        fs.writeFileSync(wordOutputPath, wordBuffer);

        res.download(wordOutputPath);
    } catch (err) {
        console.error('Error during PDF to Word conversion:', err.message);
        res.status(500).send('Conversion failed. The PDF format may be unsupported.');
    }
});

// Convert Word to PDF
app.post('/convert-word-to-pdf', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const wordFilePath = req.file.path;
    const pdfOutputPath = path.join(CONVERTED_DIR, `${req.file.filename}.pdf`);

    try {
        const wordBuffer = fs.readFileSync(wordFilePath);
        const { value: text } = await mammoth.extractRawText({ buffer: wordBuffer });

        const pdfDoc = new PDFDocument();
        const pdfStream = fs.createWriteStream(pdfOutputPath);

        pdfDoc.pipe(pdfStream);
        pdfDoc.text(text, { align: 'left' });
        pdfDoc.end();

        pdfStream.on('finish', () => {
            res.download(pdfOutputPath);
        });
    } catch (err) {
        console.error('Error during conversion:', err);
        res.status(500).send('Conversion failed.');
    }
});

// Serve frontend
app.use(express.static('public'));

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
