import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private app: admin.app.App;

  constructor() {
    if (!admin.apps.length) {
      // When running on Firebase (Cloud Functions), use applicationDefault().
      // When running locally with a service account key, use cert().
      const privateKey = process.env.FB_PRIVATE_KEY
        ? process.env.FB_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      const credential =
        privateKey && process.env.FB_CLIENT_EMAIL
          ? admin.credential.cert({
              projectId: process.env.FB_PROJECT_ID,
              clientEmail: process.env.FB_CLIENT_EMAIL,
              privateKey,
            })
          : admin.credential.applicationDefault();

      this.app = admin.initializeApp({
        credential,
        storageBucket: process.env.FB_STORAGE_BUCKET,
      });
    } else {
      this.app = admin.apps[0]!;
    }
  }

  get firestore(): admin.firestore.Firestore {
    return this.app.firestore();
  }

  get auth(): admin.auth.Auth {
    return this.app.auth();
  }

  get storage(): admin.storage.Storage {
    return this.app.storage();
  }
}
