import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const FACEBOOK_API_VERSION = 'v18.0';
const FACEBOOK_API_BASE = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

class FacebookController {
  constructor() {
    this.pageId = process.env.FACEBOOK_PAGE_ID;
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!this.pageId || !this.accessToken) {
      throw new Error('Missing Facebook credentials in .env file');
    }
  }

  /**
   * Upload photos to Facebook and return photo IDs
   */
  async uploadPhotos(imagePaths) {
    const photoIds = [];

    for (const imagePath of imagePaths) {
      try {
        if (!fs.existsSync(imagePath)) {
          console.log(`⚠️  Image not found: ${imagePath}`);
          continue;
        }

        const formData = new FormData();
        formData.append('source', fs.createReadStream(imagePath));
        formData.append('published', 'false'); // Don't publish yet
        formData.append('access_token', this.accessToken);

        const response = await axios.post(
          `${FACEBOOK_API_BASE}/${this.pageId}/photos`,
          formData,
          {
            headers: formData.getHeaders()
          }
        );

        if (response.data.id) {
          photoIds.push(response.data.id);
          console.log(`✅ Uploaded photo: ${path.basename(imagePath)} (ID: ${response.data.id})`);
        }
      } catch (error) {
        console.error(`❌ Failed to upload ${imagePath}:`, error.response?.data || error.message);
      }
    }

    return photoIds;
  }

  /**
   * Post text only to Facebook page
   */
  async postText(message) {
    try {
      const response = await axios.post(
        `${FACEBOOK_API_BASE}/${this.pageId}/feed`,
        {
          message: message,
          access_token: this.accessToken
        }
      );

      console.log(`✅ Posted to Facebook (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to post text:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Post text with single image
   */
  async postWithImage(message, imagePath) {
    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image not found: ${imagePath}`);
      }

      const formData = new FormData();
      formData.append('message', message);
      formData.append('source', fs.createReadStream(imagePath));
      formData.append('access_token', this.accessToken);

      const response = await axios.post(
        `${FACEBOOK_API_BASE}/${this.pageId}/photos`,
        formData,
        {
          headers: formData.getHeaders()
        }
      );

      console.log(`✅ Posted with image to Facebook (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to post with image:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Post text with multiple images (album)
   */
  async postWithMultipleImages(message, imagePaths) {
    try {
      if (imagePaths.length === 0) {
        return await this.postText(message);
      }

      if (imagePaths.length === 1) {
        return await this.postWithImage(message, imagePaths[0]);
      }

      // Upload all photos first (unpublished)
      console.log(`📤 Uploading ${imagePaths.length} photos...`);
      const photoIds = await this.uploadPhotos(imagePaths);

      if (photoIds.length === 0) {
        console.log('⚠️  No photos uploaded, posting text only');
        return await this.postText(message);
      }

      // Create the post with all photo IDs
      const attachedMedia = photoIds.map(id => ({ media_fbid: id }));

      const response = await axios.post(
        `${FACEBOOK_API_BASE}/${this.pageId}/feed`,
        {
          message: message,
          attached_media: JSON.stringify(attachedMedia),
          access_token: this.accessToken
        }
      );

      console.log(`✅ Posted album with ${photoIds.length} photos (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to post album:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Main method to post scraped content
   */
  async postScrapedContent(scrapedData) {
    try {
      console.log('\n📤 Posting to Facebook...');
      
      const { title, content, images, url } = scrapedData;

      // Format the message
      let message = '';
      if (title) {
        message += `${title}\n\n`;
      }
      if (content) {
        // Limit content length for Facebook (63206 chars max)
        const maxLength = 5000;
        const truncatedContent = content.length > maxLength 
          ? content.substring(0, maxLength) + '...' 
          : content;
        message += `${truncatedContent}\n\n`;
      }
      message += `🔗 Source: ${url}`;

      // Post based on image count
      if (images && images.length > 0) {
        return await this.postWithMultipleImages(message, images);
      } else {
        return await this.postText(message);
      }
    } catch (error) {
      console.error('❌ Error posting to Facebook:', error);
      throw error;
    }
  }
}

export { FacebookController };

// Test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fb = new FacebookController();
  
  const testData = {
    title: 'Test Post from Quora Scraper',
    content: 'This is a test post to verify the Facebook API integration is working correctly.',
    url: 'https://www.quora.com',
    images: []
  };

  fb.postScrapedContent(testData)
    .then(result => {
      console.log('✅ Test post successful:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}