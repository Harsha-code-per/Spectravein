"""
SQLAlchemy ORM domain models.
"""

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AsteroidDB(Base):
    """
    ORM model mapped to the `asteroids` table.
    Mirrors CSV-derived fields requested for DB seeding.
    """

    __tablename__ = "asteroids"

    designation: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=True)
    absolute_magnitude: Mapped[float] = mapped_column(Float, nullable=False)
    est_diameter_min: Mapped[float] = mapped_column(Float, nullable=False)
    est_diameter_max: Mapped[float] = mapped_column(Float, nullable=False)
    albedo: Mapped[float] = mapped_column(Float, nullable=False)
    e: Mapped[float] = mapped_column(Float, nullable=False)
    a: Mapped[float] = mapped_column(Float, nullable=False)
    i: Mapped[float] = mapped_column(Float, nullable=False)
    moid: Mapped[float] = mapped_column(Float, nullable=False)
    class_label: Mapped[str] = mapped_column(String(8), nullable=False)
