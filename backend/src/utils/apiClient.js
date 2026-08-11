import axios from 'axios';
import clubapiConfig from '../config/clubapi.js';

class ClubAPIClient {
  constructor() {
    this.client = axios.create({
      baseURL: clubapiConfig.baseURL,
      headers: clubapiConfig.headers,
      timeout: 30000
    });
  }

  async makeRequest(endpoint, data) {
    try {
      if (!clubapiConfig.token) throw new Error('ClubAPI token is not configured');
      const response = await this.client.post(endpoint, {
        token: clubapiConfig.token,
        ...data
      });
      return response.data;
    } catch (error) {
      console.error('API Request failed:', error.message);
      throw error;
    }
  }

  async makeDirectRequest(data) {
    try {
      if (!clubapiConfig.token) throw new Error('ClubAPI token is not configured');
      const response = await axios.post(clubapiConfig.directURL, {
        token: clubapiConfig.token,
        ...data
      }, {
        headers: clubapiConfig.headers,
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error('Direct API Request failed:', error.message);
      throw error;
    }
  }
}

export default new ClubAPIClient();
