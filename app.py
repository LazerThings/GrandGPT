from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from models import db, User, Chat, Message
from anthropic import Anthropic
import os
from dotenv import load_dotenv
from datetime import datetime
import markdown

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chatbot.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Initialize Anthropic client
anthropic_client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# Bot configuration
BOT_NAME = "Claude"
MODEL = "claude-haiku-4-5"
SYSTEM_PROMPT = """You are Claude, an artificial intelligence.

You can speak in full GitHub Flavored Markdown and it will be formatted for the user. This is the only formatting that will work, and HTML or other code will not parse. You can still provide code to the user over code blocks in Markdown.

You are helpful, concise, and kind. You should provide quick responses and not elaborate too much on topics. You are a chatbot and should act friendly to the user, and you should try to be natural in your conversation."""

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat_page'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('chat_page'))

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if not username or not password:
            flash('Username and password are required', 'error')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return render_template('register.html')

        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        login_user(user)
        return redirect(url_for('chat_page'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('chat_page'))

    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('chat_page'))
        else:
            flash('Invalid username or password', 'error')

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/chat')
@login_required
def chat_page():
    return render_template('chat.html', bot_name=BOT_NAME)

@app.route('/api/chats', methods=['GET'])
@login_required
def get_chats():
    chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.updated_at.desc()).all()
    return jsonify([{
        'id': chat.id,
        'title': chat.title,
        'created_at': chat.created_at.isoformat(),
        'updated_at': chat.updated_at.isoformat()
    } for chat in chats])

@app.route('/api/chats', methods=['POST'])
@login_required
def create_chat():
    chat = Chat(user_id=current_user.id, title='New Chat')
    db.session.add(chat)
    db.session.commit()

    return jsonify({
        'id': chat.id,
        'title': chat.title,
        'created_at': chat.created_at.isoformat(),
        'updated_at': chat.updated_at.isoformat()
    })

@app.route('/api/chats/<int:chat_id>', methods=['GET'])
@login_required
def get_chat(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first_or_404()
    messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.created_at).all()

    return jsonify({
        'id': chat.id,
        'title': chat.title,
        'messages': [{
            'id': msg.id,
            'role': msg.role,
            'content': msg.content,
            'created_at': msg.created_at.isoformat()
        } for msg in messages]
    })

@app.route('/api/chats/<int:chat_id>', methods=['DELETE'])
@login_required
def delete_chat(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first_or_404()
    db.session.delete(chat)
    db.session.commit()

    return jsonify({'success': True})

@app.route('/api/chats/<int:chat_id>/rename', methods=['POST'])
@login_required
def rename_chat(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first_or_404()
    data = request.json
    new_title = data.get('title', '').strip()

    if not new_title:
        return jsonify({'error': 'Title cannot be empty'}), 400

    chat.title = new_title
    chat.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'title': chat.title})

@app.route('/api/chats/<int:chat_id>/messages', methods=['POST'])
@login_required
def send_message(chat_id):
    chat = Chat.query.filter_by(id=chat_id, user_id=current_user.id).first_or_404()

    data = request.json
    user_message = data.get('message', '').strip()

    if not user_message:
        return jsonify({'error': 'Message cannot be empty'}), 400

    # Save user message
    user_msg = Message(chat_id=chat_id, role='user', content=user_message)
    db.session.add(user_msg)

    # Get conversation history
    messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.created_at).all()

    # Build conversation for API
    conversation = []
    for msg in messages:
        conversation.append({
            'role': msg.role,
            'content': msg.content
        })

    # Add the new user message
    conversation.append({
        'role': 'user',
        'content': user_message
    })

    try:
        # Call Anthropic API
        response = anthropic_client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=conversation
        )

        assistant_message = response.content[0].text

        # Save assistant message
        assistant_msg = Message(chat_id=chat_id, role='assistant', content=assistant_message)
        db.session.add(assistant_msg)

        # Update chat title if it's the first message
        if len(messages) == 0:
            # Generate AI-powered title
            try:
                title_response = anthropic_client.messages.create(
                    model=MODEL,
                    max_tokens=50,
                    system="You are a helpful assistant that generates short, concise titles for chat conversations. Based on the user's first message, provide ONLY a short title (3-6 words) for the conversation. Do not include quotes, punctuation at the end, or any other text - just the title.",
                    messages=[{
                        'role': 'user',
                        'content': f"Generate a short title for a chat that starts with this message: {user_message}"
                    }]
                )
                chat.title = title_response.content[0].text.strip()
            except:
                # Fallback to simple title if AI generation fails
                chat.title = user_message[:50] + ('...' if len(user_message) > 50 else '')

        chat.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'user_message': {
                'id': user_msg.id,
                'role': 'user',
                'content': user_message,
                'created_at': user_msg.created_at.isoformat()
            },
            'assistant_message': {
                'id': assistant_msg.id,
                'role': 'assistant',
                'content': assistant_message,
                'created_at': assistant_msg.created_at.isoformat()
            },
            'chat_title': chat.title
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages/<int:message_id>/edit', methods=['POST'])
@login_required
def edit_message(message_id):
    message = Message.query.get_or_404(message_id)
    chat = Chat.query.filter_by(id=message.chat_id, user_id=current_user.id).first_or_404()

    data = request.json
    new_content = data.get('content', '').strip()

    if not new_content:
        return jsonify({'error': 'Message cannot be empty'}), 400

    # Update the user message
    message.content = new_content

    # Delete all messages after this one (including the old assistant response)
    Message.query.filter(
        Message.chat_id == message.chat_id,
        Message.created_at > message.created_at
    ).delete()

    # Get conversation history up to this point
    messages = Message.query.filter_by(chat_id=message.chat_id).order_by(Message.created_at).all()

    # Build conversation for API
    conversation = []
    for msg in messages:
        conversation.append({
            'role': msg.role,
            'content': msg.content
        })

    try:
        # Call Anthropic API to generate new response
        response = anthropic_client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=conversation
        )

        assistant_message = response.content[0].text

        # Save new assistant message
        assistant_msg = Message(chat_id=message.chat_id, role='assistant', content=assistant_message)
        db.session.add(assistant_msg)

        chat.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages/<int:message_id>/regenerate', methods=['POST'])
@login_required
def regenerate_message(message_id):
    message = Message.query.get_or_404(message_id)
    chat = Chat.query.filter_by(id=message.chat_id, user_id=current_user.id).first_or_404()

    # Delete this message and all messages after it
    Message.query.filter(
        Message.chat_id == message.chat_id,
        Message.created_at >= message.created_at
    ).delete()

    # Get conversation history up to the previous message
    messages = Message.query.filter_by(chat_id=message.chat_id).order_by(Message.created_at).all()

    if not messages:
        return jsonify({'error': 'No previous messages to regenerate from'}), 400

    # Build conversation for API
    conversation = []
    for msg in messages:
        conversation.append({
            'role': msg.role,
            'content': msg.content
        })

    try:
        # Call Anthropic API to generate new response
        response = anthropic_client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=conversation
        )

        assistant_message = response.content[0].text

        # Save new assistant message
        assistant_msg = Message(chat_id=message.chat_id, role='assistant', content=assistant_message)
        db.session.add(assistant_msg)

        chat.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
