# Changelog

All notable changes to `nova-validation-toast` will be documented in this file.

## [1.0.1] - 2025-10-20

### Fixed
- Prevent TypeError when installing axios interceptors by adding defensive checks for missing `interceptors.response.use` and handling axios function-shaped instances
- Safely access `error.response` and `response.config` to avoid undefined property errors

### Improved
- More robust extraction of server validation messages (handles nested envelopes and common fields)
- Stronger toast deduplication and suppression of generic Nova messages when specific validation errors are available
- Wrap `window.axios.create` only when available and ensure new instances are intercepted
- Ensure `Nova.request()`-returned axios instances get an interceptor attached consistently

## [1.0.0] - 2025-10-16

### Added
- Initial release
- Error deduplication functionality
- Server error extraction and display
- Axios interceptors for Nova requests
- Support for Nova 4.x and 5.x
- Configurable error patterns
- Automatic service provider registration