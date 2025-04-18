# HN Watercooler

![favicon ico](https://github.com/user-attachments/assets/a77290f1-c2c9-4b40-a913-4203333849af)


Turn Hacker News threads into engaging audio conversations. HN Watercooler is a browser-based tool that transforms text comments into a lively discussion using ElevenLabs text-to-speech technology.

## 🎧 Features

- Transform any Hacker News thread into an audio conversation
- Each commenter gets their own unique voice for easy identification
- Select from Top 100 HN stories or enter a specific thread URL
- Process single threads or batch multiple threads together
- Smart handling of quotes, references, and links
- Cost estimation before generation
- Resume generation after errors with partial audio download
- Shared links are collected and displayed with attribution

## 📋 Requirements

- An [ElevenLabs](https://elevenlabs.io) API key (free tier available)
- A modern web browser (Firefox, Safari, Chrome, Edge)

## 🚀 Usage

1. Visit [HN Watercooler](https://yourusername.github.io/hackernews-watercooler/)
2. Enter your ElevenLabs API key
3. Choose an input method:
   - Enter a Hacker News thread URL
   - Or select from the current Top 100 stories
4. Set comment limit (All or custom number)
5. Click "Generate Conversation"
6. Wait for processing to complete
7. Listen to and download your audio conversation

## ⚙️ How It Works

1. **Thread Collection**: The app fetches thread data from the Hacker News API
2. **Voice Assignment**: Each unique commenter is assigned a consistent voice
3. **Natural Processing**: Quotes, references, and links are formatted conversationally
4. **Audio Generation**: ElevenLabs API converts the processed text to speech
5. **Audio Compilation**: Individual comment audio is combined into a single file

## 🔒 Privacy

- Your ElevenLabs API key is never stored on any server
- All API requests are made directly from your browser to ElevenLabs
- No tracking or analytics are used in this application

## 💻 Development

### Structure

- `index.html`: Main application structure
- `styles.css`: Styling for the application
- `app.js`: Application logic and API interactions

### Local Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/hackernews-watercooler.git
   ```
2. Navigate to the project directory:
   ```
   cd hackernews-watercooler
   ```
3. Open `index.html` in your browser or use a local development server

## 📝 License

Released under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- [Hacker News API](https://github.com/HackerNews/API)
- [ElevenLabs](https://elevenlabs.io) for text-to-speech technology
- [Font Awesome](https://fontawesome.com) for icons

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
