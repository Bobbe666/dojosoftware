// =============================================================================
// META API SERVICE - Facebook/Instagram Integration
// =============================================================================
// Service für die Kommunikation mit der Meta Graph API
// =============================================================================

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const META_API_VERSION = 'v18.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const META_OAUTH_URL = 'https://www.facebook.com/' + META_API_VERSION + '/dialog/oauth';

class MetaApiService {
  constructor() {
    this.appId = process.env.META_APP_ID;
    this.appSecret = process.env.META_APP_SECRET;
    this.redirectUri = process.env.META_REDIRECT_URI;
  }

  // ==========================================================================
  // OAUTH FLOW
  // ==========================================================================

  /**
   * Generiert die OAuth URL für den Facebook Login
   * @param {string} state - CSRF State Token
   * @returns {string} OAuth URL
   */
  generateAuthUrl(state) {
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'business_management'
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state: state,
      scope: scopes,
      response_type: 'code'
    });

    return `${META_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Tauscht den OAuth Code gegen einen Access Token
   * @param {string} code - OAuth Code
   * @returns {Promise<Object>} Token Response
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.get(`${META_BASE_URL}/oauth/access_token`, {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: this.redirectUri,
          code: code
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Meta OAuth Token Exchange fehlgeschlagen', {
        error: error.response?.data || error.message
      });
      throw new Error('Token Exchange fehlgeschlagen: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  /**
   * Wandelt einen Short-Lived Token in einen Long-Lived Token um
   * @param {string} shortLivedToken - Kurzlebiger Token
   * @returns {Promise<Object>} Long-Lived Token Response
   */
  async exchangeForLongLivedToken(shortLivedToken) {
    try {
      const response = await axios.get(`${META_BASE_URL}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          fb_exchange_token: shortLivedToken
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Long-Lived Token Exchange fehlgeschlagen', {
        error: error.response?.data || error.message
      });
      throw new Error('Long-Lived Token Exchange fehlgeschlagen');
    }
  }

  // ==========================================================================
  // ACCOUNT MANAGEMENT
  // ==========================================================================

  /**
   * Ruft die Facebook Pages des Users ab
   * @param {string} accessToken - User Access Token
   * @returns {Promise<Array>} Liste der Pages
   */
  async getPages(accessToken) {
    try {
      const response = await axios.get(`${META_BASE_URL}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,instagram_business_account'
        }
      });

      return response.data.data || [];
    } catch (error) {
      logger.error('Fehler beim Abrufen der Facebook Pages', {
        error: error.response?.data || error.message
      });
      throw new Error('Fehler beim Abrufen der Pages');
    }
  }

  /**
   * Ruft den Instagram Business Account einer Page ab
   * @param {string} pageId - Facebook Page ID
   * @param {string} accessToken - Page Access Token
   * @returns {Promise<Object|null>} Instagram Account Info
   */
  async getInstagramAccount(pageId, accessToken) {
    try {
      const response = await axios.get(`${META_BASE_URL}/${pageId}`, {
        params: {
          access_token: accessToken,
          fields: 'instagram_business_account{id,username,profile_picture_url,followers_count}'
        }
      });

      return response.data.instagram_business_account || null;
    } catch (error) {
      logger.error('Fehler beim Abrufen des Instagram Accounts', {
        error: error.response?.data || error.message
      });
      return null;
    }
  }

  /**
   * Ruft User-Informationen ab
   * @param {string} accessToken - User Access Token
   * @returns {Promise<Object>} User Info
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(`${META_BASE_URL}/me`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,email'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Fehler beim Abrufen der User Info', {
        error: error.response?.data || error.message
      });
      throw new Error('Fehler beim Abrufen der User Info');
    }
  }

  // ==========================================================================
  // FACEBOOK POSTING
  // ==========================================================================

  /**
   * Veröffentlicht einen Post auf einer Facebook Page
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page Access Token
   * @param {Object} postData - Post Daten
   * @returns {Promise<Object>} Post Response mit ID
   */
  async publishToFacebook(pageId, pageAccessToken, postData) {
    try {
      const { message, link, mediaIds } = postData;

      // Wenn Medien vorhanden, Photo/Video Post
      if (mediaIds && mediaIds.length > 0) {
        // Für mehrere Bilder: Multi-Photo Post
        if (mediaIds.length > 1) {
          const attachedMedia = mediaIds.map(id => ({ media_fbid: id }));

          const response = await axios.post(`${META_BASE_URL}/${pageId}/feed`, {
            message: message,
            attached_media: attachedMedia,
            access_token: pageAccessToken
          });

          return response.data;
        } else {
          // Einzelnes Bild mit Message
          const response = await axios.post(`${META_BASE_URL}/${pageId}/photos`, {
            caption: message,
            url: mediaIds[0], // Wenn URL, sonst photo_id verwenden
            access_token: pageAccessToken,
            published: true
          });

          return response.data;
        }
      }

      // Text-only oder Link Post
      const payload = {
        message: message,
        access_token: pageAccessToken
      };

      if (link) {
        payload.link = link;
      }

      const response = await axios.post(`${META_BASE_URL}/${pageId}/feed`, payload);

      return response.data;
    } catch (error) {
      logger.error('Fehler beim Veröffentlichen auf Facebook', {
        pageId,
        error: error.response?.data || error.message
      });
      throw new Error('Facebook Post fehlgeschlagen: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  /**
   * Lädt ein Bild für einen Facebook Post hoch
   * @param {string} pageId - Facebook Page ID
   * @param {string} pageAccessToken - Page Access Token
   * @param {string} imageUrl - URL des Bildes
   * @returns {Promise<string>} Photo ID
   */
  async uploadFacebookPhoto(pageId, pageAccessToken, imageUrl) {
    try {
      const response = await axios.post(`${META_BASE_URL}/${pageId}/photos`, {
        url: imageUrl,
        published: false, // Unpublished photo for later use
        access_token: pageAccessToken
      });

      return response.data.id;
    } catch (error) {
      logger.error('Fehler beim Hochladen des Facebook Fotos', {
        error: error.response?.data || error.message
      });
      throw new Error('Foto-Upload fehlgeschlagen');
    }
  }

  // ==========================================================================
  // INSTAGRAM POSTING
  // ==========================================================================

  /**
   * Veröffentlicht einen Post auf Instagram
   * Instagram erfordert immer ein Bild oder Video
   * @param {string} instagramAccountId - Instagram Business Account ID
   * @param {string} accessToken - Access Token
   * @param {Object} postData - Post Daten
   * @returns {Promise<Object>} Post Response
   */
  async publishToInstagram(instagramAccountId, accessToken, postData) {
    try {
      const { caption, imageUrl, videoUrl } = postData;

      if (!imageUrl && !videoUrl) {
        throw new Error('Instagram Posts benötigen ein Bild oder Video');
      }

      // Schritt 1: Media Container erstellen
      const containerParams = {
        access_token: accessToken
      };

      if (videoUrl) {
        containerParams.media_type = 'VIDEO';
        containerParams.video_url = videoUrl;
      } else {
        containerParams.image_url = imageUrl;
      }

      if (caption) {
        containerParams.caption = caption;
      }

      const containerResponse = await axios.post(
        `${META_BASE_URL}/${instagramAccountId}/media`,
        containerParams
      );

      const containerId = containerResponse.data.id;

      // Schritt 2: Status prüfen (bei Videos kann es dauern)
      if (videoUrl) {
        await this.waitForMediaProcessing(containerId, accessToken);
      }

      // Schritt 3: Media veröffentlichen
      const publishResponse = await axios.post(
        `${META_BASE_URL}/${instagramAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: accessToken
        }
      );

      return publishResponse.data;
    } catch (error) {
      logger.error('Fehler beim Veröffentlichen auf Instagram', {
        instagramAccountId,
        error: error.response?.data || error.message
      });
      throw new Error('Instagram Post fehlgeschlagen: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  /**
   * Wartet auf die Verarbeitung eines Video-Containers
   * @param {string} containerId - Media Container ID
   * @param {string} accessToken - Access Token
   */
  async waitForMediaProcessing(containerId, accessToken, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await axios.get(`${META_BASE_URL}/${containerId}`, {
        params: {
          access_token: accessToken,
          fields: 'status_code'
        }
      });

      const status = response.data.status_code;

      if (status === 'FINISHED') {
        return;
      }

      if (status === 'ERROR') {
        throw new Error('Video-Verarbeitung fehlgeschlagen');
      }

      // 2 Sekunden warten
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Video-Verarbeitung Timeout');
  }

  /**
   * Erstellt einen Instagram Carousel Post (mehrere Bilder)
   * @param {string} instagramAccountId - Instagram Business Account ID
   * @param {string} accessToken - Access Token
   * @param {Object} postData - Post Daten mit imageUrls Array
   * @returns {Promise<Object>} Post Response
   */
  async publishInstagramCarousel(instagramAccountId, accessToken, postData) {
    try {
      const { caption, imageUrls } = postData;

      if (!imageUrls || imageUrls.length < 2) {
        throw new Error('Carousel benötigt mindestens 2 Bilder');
      }

      // Schritt 1: Einzelne Media Items erstellen
      const childIds = [];
      for (const url of imageUrls) {
        const response = await axios.post(
          `${META_BASE_URL}/${instagramAccountId}/media`,
          {
            image_url: url,
            is_carousel_item: true,
            access_token: accessToken
          }
        );
        childIds.push(response.data.id);
      }

      // Schritt 2: Carousel Container erstellen
      const carouselResponse = await axios.post(
        `${META_BASE_URL}/${instagramAccountId}/media`,
        {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: caption,
          access_token: accessToken
        }
      );

      // Schritt 3: Veröffentlichen
      const publishResponse = await axios.post(
        `${META_BASE_URL}/${instagramAccountId}/media_publish`,
        {
          creation_id: carouselResponse.data.id,
          access_token: accessToken
        }
      );

      return publishResponse.data;
    } catch (error) {
      logger.error('Fehler beim Erstellen des Instagram Carousels', {
        error: error.response?.data || error.message
      });
      throw new Error('Instagram Carousel fehlgeschlagen');
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Generiert einen sicheren State Token für CSRF Protection
   * @returns {string} State Token
   */
  generateStateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Prüft ob ein Access Token noch gültig ist
   * @param {string} accessToken - Access Token
   * @returns {Promise<Object>} Token Debug Info
   */
  async debugToken(accessToken) {
    try {
      const response = await axios.get(`${META_BASE_URL}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${this.appId}|${this.appSecret}`
        }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Token Debug fehlgeschlagen', {
        error: error.response?.data || error.message
      });
      return null;
    }
  }

  /**
   * Prüft ob Credentials konfiguriert sind
   * @returns {boolean} True wenn konfiguriert
   */
  isConfigured() {
    return !!(this.appId && this.appSecret && this.redirectUri);
  }
}

module.exports = new MetaApiService();
