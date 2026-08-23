import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const BIN_DIR = path.join(process.cwd(), 'bin');
const XRAY_BIN = path.join(BIN_DIR, 'xray');
const XRAY_ZIP_URL = 'https://github.com/XTLS/Xray-core/releases/download/v1.8.8/Xray-linux-64.zip';

export async function startXrayProxy(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
      }

      // Download and extract Xray if not exists
      if (!fs.existsSync(XRAY_BIN)) {
        console.log('Downloading Xray-core...');
        const zipPath = path.join(BIN_DIR, 'xray.zip');
        execSync(`wget -qO ${zipPath} ${XRAY_ZIP_URL}`);
        
        console.log('Extracting Xray-core...');
        execSync(`unzip -q -o ${zipPath} -d ${BIN_DIR}`);
        execSync(`chmod +x ${XRAY_BIN}`);
        
        // Clean up zip
        fs.unlinkSync(zipPath);
        console.log('Xray-core installed successfully.');
      }

      console.log('Starting Xray-core...');
      // Load base config and inject environment variables if present
      const configPath = path.join(process.cwd(), 'xray-config.json');
      const runtimeConfigPath = path.join(BIN_DIR, 'runtime-xray.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (config.outbounds && config.outbounds[0] && config.outbounds[0].settings && config.outbounds[0].settings.vnext && config.outbounds[0].settings.vnext[0]) {
            const vnext = config.outbounds[0].settings.vnext[0];
            if (process.env.XRAY_ADDRESS) vnext.address = process.env.XRAY_ADDRESS;
            if (process.env.XRAY_PORT) vnext.port = Number(process.env.XRAY_PORT);
            if (process.env.XRAY_ID && vnext.users && vnext.users[0]) vnext.users[0].id = process.env.XRAY_ID;
          }
          fs.writeFileSync(runtimeConfigPath, JSON.stringify(config, null, 2));
        } catch (e) {
          console.error('Error overriding Xray config:', e);
        }
      }

      const activeConfigPath = fs.existsSync(runtimeConfigPath) ? runtimeConfigPath : configPath;
      const xrayProcess = spawn(XRAY_BIN, ['run', '-c', activeConfigPath], {
        stdio: 'pipe',
      });

      let started = false;

      xrayProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // console.log(`[Xray] ${output}`);
        if (!started && output.includes('started')) {
          started = true;
          console.log('Xray proxy started on 127.0.0.1:1080 (SOCKS) and 127.0.0.1:1081 (HTTP)');
          resolve();
        }
      });

      xrayProcess.stderr.on('data', (data) => {
        console.error(`[Xray Error] ${data}`);
      });

      xrayProcess.on('error', (err) => {
        console.error('Failed to start Xray process:', err);
        if (!started) reject(err);
      });

      xrayProcess.on('close', (code) => {
        console.log(`Xray process exited with code ${code}`);
      });

      // Fallback resolve in case the 'started' keyword is missed
      setTimeout(() => {
        if (!started) {
          started = true;
          console.log('Assuming Xray proxy started (timeout).');
          resolve();
        }
      }, 3000);

    } catch (error) {
      console.error('Error setting up Xray:', error);
      reject(error);
    }
  });
}
