// cloudinary.provider.ts
import { v2 as Cloudinary } from 'cloudinary';
import { AppConfigService } from 'src/config/AppConfig/app-config.service';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  inject: [AppConfigService],
  useFactory: (configService: AppConfigService) => {
    Cloudinary.config({
      cloud_name: configService.getCloudinaryName(),
      api_key: configService.getCloudinaryApiKey(),
      api_secret: configService.getCloudinaryApiSecret(),
    });
    return Cloudinary;
  },
};
