import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/it_asset_management',
  agentApiKey: process.env.AGENT_API_KEY || 'agt_live_9f83a4c28e10b74d92',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production_9948271',
  agentRelease: {
    latestVersion: process.env.LATEST_AGENT_VERSION || '1.0.0',
    downloadUrl: process.env.AGENT_DOWNLOAD_URL || 'http://localhost:5000/downloads/AssetMonitoringAgent.exe',
    sha256: process.env.AGENT_SHA256 || 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855'
  },
  guacamole: {
    jsonSecretKeyHex: process.env.GUACAMOLE_JSON_SECRET_KEY || '0123456789abcdef0123456789abcdef', // 16 bytes = 32 hex chars
    internalUrl: process.env.GUACAMOLE_INTERNAL_URL || 'http://localhost:8080/guacamole',
    publicUrl: process.env.GUACAMOLE_PUBLIC_URL || 'http://localhost:8080/guacamole',
    defaultVncPassword: process.env.GUACAMOLE_DEFAULT_VNC_PASSWORD || 'Hospital@2026',
    recordingPath: process.env.GUACAMOLE_RECORDING_PATH || '/var/lib/guacamole/recordings'
  }
};

