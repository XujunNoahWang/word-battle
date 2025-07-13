const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Image conversion script for WebP optimization
async function convertImagesToWebP() {
  const imagesDir = path.join(__dirname, '../data/images');
  const files = fs.readdirSync(imagesDir);
  
  console.log('🔄 Starting image conversion to WebP...');
  console.log(`📁 Found ${files.length} files in images directory`);
  
  let convertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
      const inputPath = path.join(imagesDir, file);
      const outputPath = path.join(imagesDir, file.replace(/\.(jpg|jpeg)$/i, '.webp'));
      
      // Skip if WebP already exists
      if (fs.existsSync(outputPath)) {
        console.log(`⏭️  Skipped ${file} (WebP already exists)`);
        skippedCount++;
        continue;
      }
      
      try {
        await sharp(inputPath)
          .webp({ 
            quality: 80,
            effort: 6,
            nearLossless: false
          })
          .toFile(outputPath);
        
        // Get file sizes for comparison
        const originalSize = fs.statSync(inputPath).size;
        const webpSize = fs.statSync(outputPath).size;
        const compressionRatio = ((originalSize - webpSize) / originalSize * 100).toFixed(1);
        
        console.log(`✅ Converted ${file} (${compressionRatio}% smaller)`);
        convertedCount++;
      } catch (error) {
        console.error(`❌ Failed to convert ${file}:`, error.message);
        errorCount++;
      }
    }
  }
  
  console.log('\n📊 Conversion Summary:');
  console.log(`✅ Converted: ${convertedCount} files`);
  console.log(`⏭️  Skipped: ${skippedCount} files`);
  console.log(`❌ Errors: ${errorCount} files`);
  console.log('🎉 Image conversion completed!');
}

// Run the conversion
convertImagesToWebP().catch(console.error); 