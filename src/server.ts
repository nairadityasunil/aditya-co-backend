import App from './app';
import AuthRoutes from './modules/auth/routes';
import UploadRoutes from './modules/upload/routes';
import SettingsRoutes from './modules/settings/routes';
import EnquiryRoutes from './modules/enquiries/routes';
import PublicRoutes from './modules/public/routes';
import { contentRoutes } from './modules/content/routes';

const app = new App([
  new AuthRoutes(),
  new UploadRoutes(),
  new SettingsRoutes(),
  new EnquiryRoutes(),
  new PublicRoutes(),
  ...contentRoutes(),
]);

app.listen().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
