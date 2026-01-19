
import { Jimp } from 'jimp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Helper for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateSplash() {
    const iconPath = path.join(__dirname, '../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
    const splashDir = path.join(__dirname, '../ios/App/App/Assets.xcassets/Splash.imageset');
    
    console.log('Loading icon from:', iconPath);

    try {
        const icon = await Jimp.read(iconPath);
        
        // Target dimensions
        const width = 2732;
        const height = 2732;
        
        // Create new image
        // Try to pick background color from the top-left pixel of the icon
        const bgColorInt = icon.getPixelColor(0, 0);
        // Jimp v1+ intToRGBA is static on Jimp class or instance?
        // It seems intToRGBA is exported directly or attached to Jimp
        // Let's try instance method if available, or just manually convert int to rgba
        
        const r = (bgColorInt >>> 24) & 0xFF;
        const g = (bgColorInt >>> 16) & 0xFF;
        const b = (bgColorInt >>> 8) & 0xFF;
        const a = bgColorInt & 0xFF;
        
        console.log(`Detected background RGBA: ${r},${g},${b},${a}`);

        // Create canvas
        const splash = new Jimp({ width, height, color: bgColorInt });
        
        // Calculate position
        const x = (width - icon.bitmap.width) / 2;
        const y = (height - icon.bitmap.height) / 2;
        
        console.log(`Compositing icon at x:${x}, y:${y}`);
        
        // Composite
        splash.composite(icon, x, y);
        
        // Files to generate
        const files = [
            'splash-2732x2732.png',
            'splash-2732x2732-1.png',
            'splash-2732x2732-2.png'
        ];

        for (const file of files) {
            const targetPath = path.join(splashDir, file);
            await splash.write(targetPath);
            console.log(`Generated: ${targetPath}`);
        }
        
        console.log('Splash screens generated successfully!');

    } catch (error) {
        console.error('Error generating splash screen:', error);
    }
}

generateSplash();
