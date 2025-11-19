# GrandGPT

A minimalist AI chat application built with Flask and the Anthropic API.

## Features

- **User Authentication**: Secure login and registration system
- **Chat Management**: Create, view, and delete chat conversations
- **Anthropic API Integration**: Powered by Claude Haiku 4.5
- **Markdown Support**: Responses formatted with GitHub Flavored Markdown
- **Minimalist Design**: Clean black interface with orange (#c64f0c) accents
- **Persistent Storage**: SQLite database for users and chat history

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Anthropic API key (get one at https://console.anthropic.com/)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/LazerThings/GrandGPT.git
cd GrandGPT
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

4. Edit `.env` and add your credentials:
```
ANTHROPIC_API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here
```

### Running the Application

1. Start the Flask server:
```bash
python app.py
```

2. Open your browser and navigate to:
```
http://localhost:5000
```

3. Register a new account and start chatting!

## Project Structure

```
GrandGPT/
├── app.py              # Main Flask application
├── models.py           # Database models
├── requirements.txt    # Python dependencies
├── .env               # Environment variables (create from .env.example)
├── templates/         # HTML templates
│   ├── base.html
│   ├── login.html
│   ├── register.html
│   └── chat.html
└── static/           # Static files
    ├── css/
    │   └── style.css
    └── js/
        └── chat.js
```

## Technologies Used

- **Backend**: Flask, Flask-SQLAlchemy, Flask-Login
- **AI**: Anthropic API (Claude Haiku 4.5)
- **Frontend**: Vanilla JavaScript, Marked.js for Markdown rendering
- **Database**: SQLite
- **Styling**: Custom CSS with minimalist design

## License

This project is licensed under the OSPL License - see the OSPL-LICENSE.txt file for details.
