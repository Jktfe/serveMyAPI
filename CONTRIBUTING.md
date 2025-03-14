# Contributing to ServeMyAPI

Thank you for considering contributing to ServeMyAPI! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/servemyapi.git`
3. Install dependencies: `npm install`
4. Create a new branch for your changes: `git checkout -b feature/your-feature-name`

## Development Workflow

1. Make your changes
2. Run `npm run lint` to ensure code style consistency
3. Test your changes:
   - For stdio mode: `npm run dev`
   - For HTTP mode: `npm run build && node dist/server.js`
4. Commit your changes with a descriptive commit message
5. Push to your branch: `git push origin feature/your-feature-name`
6. Open a pull request against the main repository

## Pull Request Process

1. Ensure your code passes linting
2. Update the README.md with details of your changes if appropriate
3. Include a clear description of what your changes do and why they should be included
4. Your PR will be reviewed by the maintainers, who may request changes

## Adding New Features

When adding new features:
1. Consider backward compatibility
2. Add appropriate documentation
3. Follow the existing code style

## Future Development Ideas

Some potential areas for contribution:
- Adding support for other secure credential storage systems on different platforms
- Enhancing the web UI for managing keys directly
- Adding authentication for the HTTP server
- Creating client libraries for different programming languages

## License

By contributing to ServeMyAPI, you agree that your contributions will be licensed under the project's MIT license.