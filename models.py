from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(100), nullable=True)
    custom_api_key = db.Column(db.String(255), nullable=True)
    extended_access = db.Column(db.Text, nullable=True)  # JSON array stored as text
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    chats = db.relationship('Chat', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_extended_access(self):
        """Get extended access list"""
        if self.extended_access:
            try:
                return json.loads(self.extended_access)
            except:
                return []
        return []

    def set_extended_access(self, access_list):
        """Set extended access list"""
        self.extended_access = json.dumps(access_list)

    def add_extended_access(self, access_type):
        """Add an access type to extended access"""
        access_list = self.get_extended_access()
        if access_type not in access_list:
            access_list.append(access_type)
            self.set_extended_access(access_list)

    def remove_extended_access(self, access_type):
        """Remove an access type from extended access"""
        access_list = self.get_extended_access()
        if access_type in access_list:
            access_list.remove(access_type)
            self.set_extended_access(access_list)

    def has_extended_access(self, access_type):
        """Check if user has a specific extended access"""
        return access_type in self.get_extended_access()

class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), default='New Chat')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = db.relationship('Message', backref='chat', lazy=True, cascade='all, delete-orphan')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
