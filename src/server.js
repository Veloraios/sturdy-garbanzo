const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const sign = require('./sign');
const app = express();
const upload = multer({ dest: 'upload/' });

app.use(express.static('public'));

app.post('/upload', upload.fields([
    { name: 'ipa', maxCount: 1 },
    { name: 'deb', maxCount: 1 },
    { name: 'dylib', maxCount: 1 },
    { name: 'p12', maxCount: 1 },
    { name: 'mobileprovision', maxCount: 1 },
    { name: 'appicon', maxCount: 1 }
]), async (req, res) => {
    try {
        const ipaFile = req.files['ipa'][0];
        const debFile = req.files['deb'] ? req.files['deb'][0] : null;
        const dylibFile = req.files['dylib'] ? req.files['dylib'][0] : null;
        const p12File = req.files['p12'][0];
        const mpFile = req.files['mobileprovision'][0];
        const appIcon = req.files['appicon'] ? req.files['appicon'][0] : null;

        const { appname, appversion } = req.body;

        // Process the files and sign the IPA
        const signedIPA = await sign.process({
            ipaFile,
            debFile,
            dylibFile,
            p12File,
            mpFile,
            appIcon,
            appname,
            appversion
        });

        // Delete the files after 5 minutes
        setTimeout(() => {
            fs.remove(ipaFile.path);
            if (debFile) fs.remove(debFile.path);
            if (dylibFile) fs.remove(dylibFile.path);
            fs.remove(p12File.path);
            fs.remove(mpFile.path);
            if (appIcon) fs.remove(appIcon.path);
        }, 300000); // 5 minutes

        res.send(`IPA signed successfully! Download from <a href="${signedIPA}">${signedIPA}</a>`);
    } catch (err) {
        res.status(500).send('Error processing files: ' + err.message);
    }
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
