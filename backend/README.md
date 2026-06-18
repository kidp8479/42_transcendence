# Backend - NestJS

## Known audit warnings

`@nestjs/platform-express` depends on `multer` which has unpatched CVEs
([GHSA-72gw-mp4g-v24j](https://github.com/advisories/GHSA-72gw-mp4g-v24j),
[GHSA-3p4h-7m6x-2hcm](https://github.com/advisories/GHSA-3p4h-7m6x-2hcm)).
No fix is available upstream yet. The vulnerability is in file-upload parsing,
which is not used by this service.

Alternative: replace `@nestjs/platform-express` with `@nestjs/platform-fastify`
to eliminate the dependency entirely.
