# NeoTunnel

A modern, user-friendly graphical interface for managing VPN server connections on Linux. NeoTunnel provides an intuitive desktop application built with Electron, making it easy to connect to VPN servers, manage configurations, and monitor connection status.

## Features

- 🖥️ **Graphical User Interface** - Clean and intuitive desktop application for Linux
- 🔌 **Easy Server Management** - Add, remove, and organize VPN servers with ease
- 📡 **Multiple Protocol Support** - Supports VLESS, VMESS, and other Xray-core protocols
- 🔄 **Subscription Management** - Import and manage server subscriptions from URLs
- 📊 **Connection Monitoring** - Real-time speed monitoring and connection status
- ⚡ **Quick Connect** - One-click connection to your favorite servers
- 🔒 **Secure** - Built on top of Xray-core for reliable and secure connections
- 🎯 **Server Testing** - Test server connectivity before connecting

## Requirements

- Linux (tested on modern distributions)
- Node.js (for development)
- Xray-core binary (included in releases)

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/Mihuil121/NeoTunnel.git
cd NeoTunnel
```

2. Install dependencies:
```bash
npm install
```

3. Run the application:
```bash
npm start
```

### Building

To build the application for Linux:

```bash
npm run build:linux
```

This will create an AppImage and DEB package in the `dist` directory.

## Usage

1. **Launch NeoTunnel** - Start the application from your application menu or by running `npm start`

2. **Add Servers** - 
   - Import servers from a subscription URL
   - Add individual server configurations manually
   - Import from clipboard or file

3. **Connect** - Select a server from the list and click connect

4. **Monitor** - View real-time connection speed and status in the interface

## Configuration

NeoTunnel supports various VPN protocols and configurations compatible with Xray-core:

- VLESS with XTLS, REALITY, and other transport methods
- VMESS
- Custom Xray configuration files

## Project Structure

```
NeoTunnel/
├── src/
│   ├── core/          # Core functionality (config management, Xray runner)
│   ├── main/          # Main process modules (speed monitoring)
│   └── shared/        # Shared utilities
├── my-vpn-gui/        # GUI resources
├── main.js            # Electron main process
├── vpn.js             # VPN connection logic
└── package.json       # Project configuration
```

## Development

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Electron development tools

### Running in Development Mode

```bash
npm start
```

### Building for Production

```bash
npm run build
```

## Technologies

- **Electron** - Cross-platform desktop application framework
- **Xray-core** - Network proxy tool (XTLS/Xray-core)
- **Node.js** - Runtime environment

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on top of [Xray-core](https://github.com/XTLS/Xray-core) by Project X
- Uses Electron for the desktop interface

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or contributions, please open an issue on the [GitHub repository](https://github.com/Mihuil121/NeoTunnel).

---

**Note**: This is a graphical shell for VPN server connections on Linux. Make sure you have proper authorization to use VPN services and comply with your local laws and regulations.
