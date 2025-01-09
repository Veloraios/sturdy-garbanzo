const fs = require('fs-extra');
const path = require('path');
const child_process = require('child_process');
const { promisify } = require('util');

const exec = promisify(child_process.exec);

// Function to import the P12 certificate into the Keychain
async function importP12(p12FilePath, password) {
    const command = `security import ${p12FilePath} -k ~/Library/Keychains/login.keychain -P ${password} -T /usr/bin/codesign`;
    await exec(command);
}

// Function to sign IPA files and handle DEB files
async function process({ ipaFile, debFile, dylibFile, p12File, mpFile, appIcon, appname, appversion }) {
    try {
        const ipaFolder = path.join(__dirname, 'upload/ipa');
        const tempFolder = path.join(__dirname, 'temp');
        
        // Ensure directories exist
        await fs.ensureDir(ipaFolder);
        await fs.ensureDir(tempFolder);

        // Step 1: Handle DEB files (if any)
        if (debFile) {
            const debFolder = path.join(tempFolder, 'deb');
            await fs.ensureDir(debFolder);
            await exec(`dpkg-deb -x ${debFile.path} ${debFolder}`);
        }

        // Step 2: Import P12 certificate if provided
        if (p12File) {
            const p12Password = 'your-p12-password'; // Collect securely in real applications
            await importP12(p12File.path, p12Password);
        }

        // Step 3: Sign the IPA file
        const ipaPath = ipaFile.path;
        const signedIPAPath = path.join(ipaFolder, 'signed.ipa');

        // Use xcrun to sign the IPA
        const command = `xcrun -sdk iphoneos codesign -f -s "iPhone Developer: My Name" --entitlements ./entitlements.plist ${ipaPath}`;
        await exec(command);

        // Step 4: If an app icon is provided, replace it
        if (appIcon) {
            const iconPath = path.join(ipaFolder, 'Payload', 'MyApp.app', 'Icon.png');
            await fs.copy(appIcon.path, iconPath);
        }

        // Step 5: Modify app name and version if provided
        if (appname || appversion) {
            const infoPlistPath = path.join(ipaFolder, 'Payload', 'MyApp.app', 'Info.plist');
            let plist = await fs.readFile(infoPlistPath, 'utf8');
            if (appname) {
                plist = plist.replace(/<key>CFBundleDisplayName<\/key>.*?<string>.*?<\/string>/, `<key>CFBundleDisplayName</key><string>${appname}</string>`);
            }
            if (appversion) {
                plist = plist.replace(/<key>CFBundleShortVersionString<\/key>.*?<string>.*?<\/string>/, `<key>CFBundleShortVersionString</key><string>${appversion}</string>`);
            }
            await fs.writeFile(infoPlistPath, plist);
        }

        // Step 6: Create the signed IPA file (repackage it)
        await exec(`xcrun -sdk iphoneos -v -f ipa -C -o ${signedIPAPath} ${ipaPath}`);

        return signedIPAPath;
    } catch (err) {
        throw new Error('Signing failed: ' + err.message);
    }
}

module.exports = { process };
