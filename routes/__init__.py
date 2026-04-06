from fastapi import APIRouter

router = APIRouter()

from routes import customers, repairs, appointments, vehicles, uploads, price_list  # noqa: E402, F401

router.include_router(customers.router)
router.include_router(repairs.router)
router.include_router(appointments.router)
router.include_router(vehicles.router)
router.include_router(uploads.router)
router.include_router(price_list.router)
