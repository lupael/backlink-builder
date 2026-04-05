"""
Backlink Builder - Flask Backend Application
Provides REST API for backlink management, crawling, submission, and reporting.
"""
import os
import json
import uuid
import hashlib
import random
import string
import datetime
import io
import csv
from functools import wraps

from flask import Flask, jsonify, request, Response
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from flask_cors import CORS
import bcrypt

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "jwt-dev-secret-change-in-prod")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = datetime.timedelta(hours=8)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = datetime.timedelta(days=30)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'backlink_builder.db')}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

db = SQLAlchemy(app)
jwt = JWTManager(app)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), default="viewer")  # admin | manager | viewer
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))

    def set_password(self, password: str):
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


class BacklinkOpportunity(db.Model):
    """Represents a discovered or known backlink opportunity directory/site."""
    __tablename__ = "backlink_opportunities"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(512), nullable=False)
    category = db.Column(db.String(100))          # directory | blog | forum | citation
    domain_authority = db.Column(db.Integer, default=0)
    spam_score = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    requires_registration = db.Column(db.Boolean, default=False)
    auto_submit = db.Column(db.Boolean, default=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "category": self.category,
            "domain_authority": self.domain_authority,
            "spam_score": self.spam_score,
            "is_active": self.is_active,
            "requires_registration": self.requires_registration,
            "auto_submit": self.auto_submit,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
        }


class BacklinkSubmission(db.Model):
    """Tracks each submission attempt."""
    __tablename__ = "backlink_submissions"
    id = db.Column(db.Integer, primary_key=True)
    target_url = db.Column(db.String(512), nullable=False)
    anchor_text = db.Column(db.String(255))
    opportunity_id = db.Column(db.Integer, db.ForeignKey("backlink_opportunities.id"), nullable=True)
    opportunity = db.relationship("BacklinkOpportunity", backref="submissions")
    status = db.Column(db.String(50), default="pending")  # pending | submitted | approved | rejected | failed
    notes = db.Column(db.Text)
    submitted_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    user = db.relationship("User", backref="submissions")
    retry_count = db.Column(db.Integer, default=0)
    submitted_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))

    def to_dict(self):
        return {
            "id": self.id,
            "target_url": self.target_url,
            "anchor_text": self.anchor_text,
            "opportunity": self.opportunity.to_dict() if self.opportunity else None,
            "status": self.status,
            "notes": self.notes,
            "retry_count": self.retry_count,
            "submitted_by": self.user.name if self.user else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# RBAC helper
# ---------------------------------------------------------------------------

ROLE_HIERARCHY = {"admin": 3, "manager": 2, "viewer": 1}


def roles_required(*roles):
    """Decorator: require one of the given roles."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            user_role = claims.get("role", "viewer")
            if user_role not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    required = ["email", "password", "name"]
    if not all(k in data for k in required):
        return jsonify({"error": "Missing required fields"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    # First user is admin
    role = "admin" if User.query.count() == 0 else data.get("role", "viewer")
    user = User(email=data["email"], name=data["name"], role=role)
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "name": user.name},
    )
    refresh_token = create_refresh_token(identity=str(user.id))
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    user = User.query.filter_by(email=data.get("email", "")).first()
    if not user or not user.check_password(data.get("password", "")):
        return jsonify({"error": "Invalid credentials"}), 401
    if not user.is_active:
        return jsonify({"error": "Account disabled"}), 403

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "name": user.name},
    )
    refresh_token = create_refresh_token(identity=str(user.id))
    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    })


@app.route("/api/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "name": user.name},
    )
    return jsonify({"access_token": access_token})


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user.to_dict()})


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------

@app.route("/api/users", methods=["GET"])
@roles_required("admin")
def list_users():
    users = User.query.all()
    return jsonify({"users": [u.to_dict() for u in users]})


@app.route("/api/users/<int:user_id>", methods=["PATCH"])
@roles_required("admin")
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    if "role" in data:
        user.role = data["role"]
    if "is_active" in data:
        user.is_active = data["is_active"]
    if "name" in data:
        user.name = data["name"]
    db.session.commit()
    return jsonify({"user": user.to_dict()})


# ---------------------------------------------------------------------------
# Opportunities
# ---------------------------------------------------------------------------

@app.route("/api/opportunities", methods=["GET"])
@jwt_required()
def list_opportunities():
    category = request.args.get("category")
    min_da = request.args.get("min_da", type=int, default=0)
    max_spam = request.args.get("max_spam", type=int, default=100)
    query = BacklinkOpportunity.query.filter_by(is_active=True)
    if category:
        query = query.filter_by(category=category)
    query = query.filter(
        BacklinkOpportunity.domain_authority >= min_da,
        BacklinkOpportunity.spam_score <= max_spam,
    )
    opps = query.order_by(BacklinkOpportunity.domain_authority.desc()).all()
    return jsonify({"opportunities": [o.to_dict() for o in opps]})


@app.route("/api/opportunities/<int:opp_id>", methods=["GET"])
@jwt_required()
def get_opportunity(opp_id):
    opp = BacklinkOpportunity.query.get_or_404(opp_id)
    return jsonify({"opportunity": opp.to_dict()})


@app.route("/api/opportunities", methods=["POST"])
@roles_required("admin", "manager")
def create_opportunity():
    data = request.get_json() or {}
    if not data.get("name") or not data.get("url"):
        return jsonify({"error": "name and url are required"}), 400
    opp = BacklinkOpportunity(
        name=data["name"],
        url=data["url"],
        category=data.get("category", "directory"),
        domain_authority=data.get("domain_authority", 0),
        spam_score=data.get("spam_score", 0),
        requires_registration=data.get("requires_registration", False),
        auto_submit=data.get("auto_submit", False),
        description=data.get("description", ""),
    )
    db.session.add(opp)
    db.session.commit()
    return jsonify({"opportunity": opp.to_dict()}), 201


@app.route("/api/opportunities/<int:opp_id>", methods=["PATCH"])
@roles_required("admin", "manager")
def update_opportunity(opp_id):
    opp = BacklinkOpportunity.query.get_or_404(opp_id)
    data = request.get_json() or {}
    for field in ["name", "url", "category", "domain_authority", "spam_score",
                  "is_active", "requires_registration", "auto_submit", "description"]:
        if field in data:
            setattr(opp, field, data[field])
    db.session.commit()
    return jsonify({"opportunity": opp.to_dict()})


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------

@app.route("/api/submissions", methods=["GET"])
@jwt_required()
def list_submissions():
    status = request.args.get("status")
    target_url = request.args.get("target_url")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 25, type=int)

    query = BacklinkSubmission.query
    if status:
        query = query.filter_by(status=status)
    if target_url:
        query = query.filter(BacklinkSubmission.target_url.ilike(f"%{target_url}%"))

    pagination = query.order_by(BacklinkSubmission.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify({
        "submissions": [s.to_dict() for s in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": pagination.page,
    })


@app.route("/api/submissions/<int:sub_id>", methods=["GET"])
@jwt_required()
def get_submission(sub_id):
    sub = BacklinkSubmission.query.get_or_404(sub_id)
    return jsonify({"submission": sub.to_dict()})


@app.route("/api/submissions", methods=["POST"])
@jwt_required()
def create_submission():
    data = request.get_json() or {}
    if not data.get("target_url"):
        return jsonify({"error": "target_url is required"}), 400

    user_id = int(get_jwt_identity())
    sub = BacklinkSubmission(
        target_url=data["target_url"],
        anchor_text=data.get("anchor_text", ""),
        opportunity_id=data.get("opportunity_id"),
        status="pending",
        notes=data.get("notes", ""),
        submitted_by=user_id,
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify({"submission": sub.to_dict()}), 201


@app.route("/api/submissions/<int:sub_id>", methods=["PATCH"])
@roles_required("admin", "manager")
def update_submission(sub_id):
    sub = BacklinkSubmission.query.get_or_404(sub_id)
    data = request.get_json() or {}
    if "status" in data:
        sub.status = data["status"]
        if data["status"] == "submitted" and not sub.submitted_at:
            sub.submitted_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    if "notes" in data:
        sub.notes = data["notes"]
    if "anchor_text" in data:
        sub.anchor_text = data["anchor_text"]
    sub.updated_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return jsonify({"submission": sub.to_dict()})


@app.route("/api/submissions/<int:sub_id>/retry", methods=["POST"])
@roles_required("admin", "manager")
def retry_submission(sub_id):
    sub = BacklinkSubmission.query.get_or_404(sub_id)
    sub.status = "pending"
    sub.retry_count += 1
    sub.updated_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return jsonify({"submission": sub.to_dict()})


# ---------------------------------------------------------------------------
# Bulk submit (queue all auto-submit opportunities for a URL)
# ---------------------------------------------------------------------------

@app.route("/api/submit", methods=["POST"])
@jwt_required()
def bulk_submit():
    data = request.get_json() or {}
    target_url = data.get("target_url")
    anchor_text = data.get("anchor_text", "")
    min_da = data.get("min_da", 20)
    max_spam = data.get("max_spam", 10)

    if not target_url:
        return jsonify({"error": "target_url is required"}), 400

    user_id = int(get_jwt_identity())
    opps = BacklinkOpportunity.query.filter_by(is_active=True).filter(
        BacklinkOpportunity.domain_authority >= min_da,
        BacklinkOpportunity.spam_score <= max_spam,
    ).all()

    created = []
    for opp in opps:
        # Check if a pending/submitted entry already exists
        existing = BacklinkSubmission.query.filter_by(
            target_url=target_url, opportunity_id=opp.id
        ).filter(BacklinkSubmission.status.in_(["pending", "submitted", "approved"])).first()
        if existing:
            continue
        sub = BacklinkSubmission(
            target_url=target_url,
            anchor_text=anchor_text,
            opportunity_id=opp.id,
            status="pending",
            submitted_by=user_id,
        )
        db.session.add(sub)
        created.append(sub)

    db.session.commit()
    return jsonify({
        "queued": len(created),
        "message": f"Queued {len(created)} submissions for {target_url}",
    })


# ---------------------------------------------------------------------------
# Dashboard metrics
# ---------------------------------------------------------------------------

@app.route("/api/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    total_submissions = BacklinkSubmission.query.count()
    pending = BacklinkSubmission.query.filter_by(status="pending").count()
    submitted = BacklinkSubmission.query.filter_by(status="submitted").count()
    approved = BacklinkSubmission.query.filter_by(status="approved").count()
    rejected = BacklinkSubmission.query.filter_by(status="rejected").count()
    failed = BacklinkSubmission.query.filter_by(status="failed").count()

    success_rate = (
        round((approved / total_submissions) * 100, 1) if total_submissions > 0 else 0
    )

    total_opportunities = BacklinkOpportunity.query.filter_by(is_active=True).count()

    # Average DA of submitted/approved
    from sqlalchemy import func
    avg_da_row = (
        db.session.query(func.avg(BacklinkOpportunity.domain_authority))
        .join(BacklinkSubmission, BacklinkSubmission.opportunity_id == BacklinkOpportunity.id)
        .filter(BacklinkSubmission.status.in_(["submitted", "approved"]))
        .scalar()
    )
    avg_da = round(float(avg_da_row), 1) if avg_da_row else 0

    # Submissions per day (last 14 days) - use strftime for SQLite compat
    from sqlalchemy import func as _func, text as _text
    fourteen_days_ago = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(days=14)
    daily_rows = (
        db.session.query(
            func.strftime("%Y-%m-%d", BacklinkSubmission.created_at).label("day"),
            func.count(BacklinkSubmission.id).label("count"),
        )
        .filter(BacklinkSubmission.created_at >= fourteen_days_ago)
        .group_by(func.strftime("%Y-%m-%d", BacklinkSubmission.created_at))
        .order_by(func.strftime("%Y-%m-%d", BacklinkSubmission.created_at))
        .all()
    )
    daily_data = [{"date": row.day, "count": row.count} for row in daily_rows]

    # Category distribution
    cat_rows = (
        db.session.query(
            BacklinkOpportunity.category,
            func.count(BacklinkSubmission.id).label("count"),
        )
        .join(BacklinkSubmission, BacklinkSubmission.opportunity_id == BacklinkOpportunity.id)
        .group_by(BacklinkOpportunity.category)
        .all()
    )
    category_data = [{"category": r.category or "unknown", "count": r.count} for r in cat_rows]

    return jsonify({
        "total_submissions": total_submissions,
        "pending": pending,
        "submitted": submitted,
        "approved": approved,
        "rejected": rejected,
        "failed": failed,
        "success_rate": success_rate,
        "total_opportunities": total_opportunities,
        "avg_domain_authority": avg_da,
        "daily_submissions": daily_data,
        "category_distribution": category_data,
    })


# ---------------------------------------------------------------------------
# Reports / export
# ---------------------------------------------------------------------------

@app.route("/api/reports/export", methods=["GET"])
@jwt_required()
def export_report():
    fmt = request.args.get("format", "csv")
    status = request.args.get("status")
    target_url = request.args.get("target_url")

    query = BacklinkSubmission.query
    if status:
        query = query.filter_by(status=status)
    if target_url:
        query = query.filter(BacklinkSubmission.target_url.ilike(f"%{target_url}%"))

    submissions = query.order_by(BacklinkSubmission.created_at.desc()).all()

    rows = []
    for s in submissions:
        rows.append({
            "id": s.id,
            "target_url": s.target_url,
            "anchor_text": s.anchor_text,
            "opportunity_name": s.opportunity.name if s.opportunity else "",
            "opportunity_url": s.opportunity.url if s.opportunity else "",
            "category": s.opportunity.category if s.opportunity else "",
            "domain_authority": s.opportunity.domain_authority if s.opportunity else "",
            "spam_score": s.opportunity.spam_score if s.opportunity else "",
            "status": s.status,
            "notes": s.notes,
            "retry_count": s.retry_count,
            "submitted_by": s.user.name if s.user else "",
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else "",
            "created_at": s.created_at.isoformat(),
        })

    if fmt == "json":
        return Response(
            json.dumps({"submissions": rows, "exported_at": datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).isoformat()},
                       indent=2),
            mimetype="application/json",
            headers={"Content-Disposition": "attachment; filename=backlink_report.json"},
        )

    # Default: CSV
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    else:
        output.write("No data\n")

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=backlink_report.csv"},
    )


# ---------------------------------------------------------------------------
# Seed data helpers
# ---------------------------------------------------------------------------

SAMPLE_OPPORTUNITIES = [
    {"name": "DMOZ Open Directory", "url": "https://dmoz-odp.org", "category": "directory", "domain_authority": 91, "spam_score": 1, "auto_submit": False},
    {"name": "Best of the Web", "url": "https://botw.org", "category": "directory", "domain_authority": 75, "spam_score": 2, "auto_submit": False},
    {"name": "Jasmine Directory", "url": "https://www.jasminedirectory.com", "category": "directory", "domain_authority": 42, "spam_score": 3, "auto_submit": True},
    {"name": "Aviva Directory", "url": "https://www.avivadirectory.com", "category": "directory", "domain_authority": 38, "spam_score": 4, "auto_submit": True},
    {"name": "eLib Directory", "url": "https://www.elibdirectory.com", "category": "directory", "domain_authority": 30, "spam_score": 5, "auto_submit": True},
    {"name": "Reddit r/SEO", "url": "https://reddit.com/r/SEO", "category": "forum", "domain_authority": 95, "spam_score": 2, "auto_submit": False},
    {"name": "Warrior Forum", "url": "https://www.warriorforum.com", "category": "forum", "domain_authority": 63, "spam_score": 8, "auto_submit": False},
    {"name": "Moz Community", "url": "https://moz.com/community", "category": "forum", "domain_authority": 91, "spam_score": 1, "auto_submit": False},
    {"name": "Medium", "url": "https://medium.com", "category": "blog", "domain_authority": 95, "spam_score": 1, "auto_submit": False},
    {"name": "HubPages", "url": "https://hubpages.com", "category": "blog", "domain_authority": 72, "spam_score": 3, "auto_submit": True},
    {"name": "Blogger", "url": "https://blogger.com", "category": "blog", "domain_authority": 96, "spam_score": 1, "auto_submit": False},
    {"name": "Yelp Business", "url": "https://biz.yelp.com", "category": "citation", "domain_authority": 94, "spam_score": 1, "auto_submit": False},
    {"name": "Yellow Pages", "url": "https://www.yellowpages.com", "category": "citation", "domain_authority": 80, "spam_score": 2, "auto_submit": False},
    {"name": "Foursquare", "url": "https://foursquare.com", "category": "citation", "domain_authority": 92, "spam_score": 1, "auto_submit": False},
    {"name": "Hotfrog", "url": "https://www.hotfrog.com", "category": "citation", "domain_authority": 55, "spam_score": 5, "auto_submit": True},
    {"name": "Cylex", "url": "https://www.cylex.us.com", "category": "citation", "domain_authority": 50, "spam_score": 6, "auto_submit": True},
    {"name": "AboutUs", "url": "https://aboutus.com", "category": "directory", "domain_authority": 45, "spam_score": 4, "auto_submit": True},
    {"name": "Web Wombat", "url": "https://www.webwombat.com.au", "category": "directory", "domain_authority": 40, "spam_score": 5, "auto_submit": True},
    {"name": "Business.com", "url": "https://www.business.com", "category": "directory", "domain_authority": 62, "spam_score": 3, "auto_submit": False},
    {"name": "Scoop.it", "url": "https://www.scoop.it", "category": "blog", "domain_authority": 70, "spam_score": 4, "auto_submit": True},
]


def seed_database():
    """Seed the database with sample data if empty."""
    if BacklinkOpportunity.query.count() == 0:
        for opp_data in SAMPLE_OPPORTUNITIES:
            opp = BacklinkOpportunity(**opp_data)
            db.session.add(opp)
        db.session.commit()

    # Seed demo user if no users exist
    if User.query.count() == 0:
        admin = User(email="admin@backlink.io", name="Admin User", role="admin")
        admin.set_password("Admin@123!")
        manager = User(email="manager@backlink.io", name="SEO Manager", role="manager")
        manager.set_password("Manager@123!")
        viewer = User(email="viewer@backlink.io", name="Viewer", role="viewer")
        viewer.set_password("Viewer@123!")
        db.session.add_all([admin, manager, viewer])
        db.session.commit()

    # Add demo submissions if empty
    if BacklinkSubmission.query.count() == 0:
        import random
        statuses = ["pending", "submitted", "approved", "rejected", "failed"]
        weights = [0.2, 0.3, 0.35, 0.1, 0.05]
        opps = BacklinkOpportunity.query.all()
        admin = User.query.filter_by(email="admin@backlink.io").first()
        for i, opp in enumerate(opps):
            status = random.choices(statuses, weights=weights)[0]
            days_ago = random.randint(0, 30)
            sub = BacklinkSubmission(
                target_url="https://example.com",
                anchor_text="Example Company",
                opportunity_id=opp.id,
                status=status,
                submitted_by=admin.id if admin else None,
                created_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(days=days_ago),
                submitted_at=(
                    datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(days=days_ago)
                    if status in ("submitted", "approved", "rejected") else None
                ),
            )
            db.session.add(sub)
        db.session.commit()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_database()
    app.run(host="0.0.0.0", port=5000, debug=False)
