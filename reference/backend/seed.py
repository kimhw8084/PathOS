"""
Canonical seed script for sysgrid development database.

Usage:
    cd backend
    python seed.py

Guards:
    - Exits early if system_grid.db already exists.
    - Delete the DB file first to re-seed from scratch.
"""

import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), "system_grid.db")

if os.path.exists(DB_PATH):
    print(f"DB already exists at {DB_PATH}. Delete it first to re-seed.")
    sys.exit(0)

# ── Step 1: Run Alembic migrations to provision schema ────────────────────────
print("Running Alembic migrations...")
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

alembic_cfg = AlembicConfig(os.path.join(os.path.dirname(__file__), "alembic.ini"))
alembic_command.upgrade(alembic_cfg, "head")
print("Schema provisioned.")

# ── Step 2: Bootstrap sync session ───────────────────────────────────────────
import sys
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.models import (
    Site, Room, Rack, Device, DeviceLocation, HardwareComponent,
    DeviceSoftware, NetworkInterface, Subnet, PortConnection,
    DeviceRelationship, LogicalService, ServiceSecret, SecretVault,
    MaintenanceWindow, MonitoringItem, IncidentLog, DataFlow,
    AuditLog, SettingOption, FirewallRule, ExternalEntity, ExternalLink,
)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)

def seed():
    with Session(engine) as db:

        # ── SettingOptions (mirrors main.py _auto_seed) ───────────────────────
        print("Seeding SettingOptions...")
        setting_defaults = [
            ("LogicalSystem", "SAP ERP", "Enterprise Resource Planning"),
            ("LogicalSystem", "HR-Core", "Human Resources Core System"),
            ("LogicalSystem", "Sales-B2B", "B2B Sales Portal"),
            ("LogicalSystem", "IT-Infra", "IT Infrastructure"),
            ("LogicalSystem", "DevOps", "DevOps Platform"),
            ("DeviceType", "Physical", "Bare metal hardware"),
            ("DeviceType", "Virtual", "Virtual machine or instance"),
            ("DeviceType", "Storage", "Storage array or appliance"),
            ("DeviceType", "Switch", "Network switch or router"),
            ("DeviceType", "Firewall", "Network firewall appliance"),
            ("DeviceType", "Load Balancer", "Load balancer appliance"),
            ("Status", "Planned", "Scheduled for deployment"),
            ("Status", "Active", "Operational and healthy"),
            ("Status", "Maintenance", "Undergoing scheduled maintenance"),
            ("Status", "Standby", "Powered on, not serving traffic"),
            ("Status", "Offline", "Powered off or unreachable"),
            ("Status", "Decommissioned", "Retired from service"),
            ("Environment", "Production", "Live user traffic"),
            ("Environment", "Staging", "Pre-production staging"),
            ("Environment", "QA", "Quality Assurance and Testing"),
            ("Environment", "Dev", "Development environment"),
            ("Environment", "DR", "Disaster Recovery Node"),
            ("Environment", "Lab", "Lab or sandbox environment"),
            ("BusinessUnit", "Engineering", "Engineering & R&D"),
            ("BusinessUnit", "Operations", "IT Operations"),
            ("BusinessUnit", "Finance", "Finance & Accounting"),
            ("BusinessUnit", "HR", "Human Resources"),
            ("BusinessUnit", "Sales", "Sales & Business Development"),
            ("BusinessUnit", "Security", "Information Security"),
        ]
        for cat, val, desc in setting_defaults:
            db.add(SettingOption(category=cat, label=val, value=val, description=desc))

        service_types = [
            ("Database", ["Engine", "Port", "DBName", "Collation", "StorageType", "ReplicaMode"]),
            ("Web Server", ["ServerType", "Port", "RootPath", "SSLExpiry", "AppPool", "Bindings"]),
            ("Container", ["Runtime", "Image", "Tag", "Namespace", "CPURequest", "MemRequest"]),
            ("Middleware", ["Vendor", "Instance", "QueueDepth", "JVMHeap", "JMXPort"]),
            ("Message Queue", ["Engine", "VHost", "Port", "ClusterMode", "Persistence"]),
            ("Cache", ["Engine", "Port", "MemoryLimit", "EvictionPolicy", "Clustered"]),
        ]
        for val, keys in service_types:
            db.add(SettingOption(category="ServiceType", label=val, value=val, metadata_keys=keys))

        db.flush()

        # ── Sites ─────────────────────────────────────────────────────────────
        print("Seeding Sites...")
        site_hq = Site(
            name="HQ Data Center",
            address="1 Infinite Loop, Cupertino, CA 95014",
            facility_manager="Alice Kim",
            contact_phone="+1-408-555-0101",
            cooling_capacity_kw=500.0,
            power_capacity_kw=1200.0,
            order_index=0,
        )
        site_dr = Site(
            name="DR Site East",
            address="100 Technology Dr, Reston, VA 20191",
            facility_manager="Bob Park",
            contact_phone="+1-703-555-0202",
            cooling_capacity_kw=200.0,
            power_capacity_kw=600.0,
            order_index=1,
        )
        site_lab = Site(
            name="R&D Lab",
            address="88 Innovation Blvd, Austin, TX 78701",
            facility_manager="Carol Chen",
            contact_phone="+1-512-555-0303",
            cooling_capacity_kw=80.0,
            power_capacity_kw=150.0,
            order_index=2,
        )
        db.add_all([site_hq, site_dr, site_lab])
        db.flush()

        # ── Rooms ─────────────────────────────────────────────────────────────
        print("Seeding Rooms...")
        room_hq_a = Room(site_id=site_hq.id, name="Room A - Core", floor_level="B1",
                         hvac_zone="HVAC-A", fire_suppression_type="FM-200")
        room_hq_b = Room(site_id=site_hq.id, name="Room B - Edge", floor_level="1F",
                         hvac_zone="HVAC-B", fire_suppression_type="Inert Gas")
        room_dr_a = Room(site_id=site_dr.id, name="DR Main Hall", floor_level="1F",
                         hvac_zone="HVAC-DR1", fire_suppression_type="FM-200")
        room_dr_b = Room(site_id=site_dr.id, name="DR Cold Aisle", floor_level="1F",
                         hvac_zone="HVAC-DR2", fire_suppression_type="Sprinkler")
        room_lab_a = Room(site_id=site_lab.id, name="Lab Zone 1", floor_level="2F",
                          hvac_zone="HVAC-LAB", fire_suppression_type="Clean Agent")
        room_lab_b = Room(site_id=site_lab.id, name="Lab Zone 2", floor_level="2F",
                          hvac_zone="HVAC-LAB2", fire_suppression_type="FM-200")
        db.add_all([room_hq_a, room_hq_b, room_dr_a, room_dr_b, room_lab_a, room_lab_b])
        db.flush()

        # ── Racks ─────────────────────────────────────────────────────────────
        print("Seeding Racks...")
        rack_hq1 = Rack(room_id=room_hq_a.id, name="HQ-A-R01", total_u_height=42,
                        max_power_kw=10.0, typical_power_kw=6.5, max_weight_kg=1200.0,
                        cooling_type="Air", pdu_a_id="PDU-A01", pdu_b_id="PDU-B01", order_index=0)
        rack_hq2 = Rack(room_id=room_hq_a.id, name="HQ-A-R02", total_u_height=42,
                        max_power_kw=10.0, typical_power_kw=7.0, max_weight_kg=1200.0,
                        cooling_type="Air", pdu_a_id="PDU-A02", pdu_b_id="PDU-B02", order_index=1)
        rack_hq3 = Rack(room_id=room_hq_b.id, name="HQ-B-R01", total_u_height=42,
                        max_power_kw=12.0, typical_power_kw=8.0, max_weight_kg=1400.0,
                        cooling_type="Liquid", pdu_a_id="PDU-A03", pdu_b_id="PDU-B03", order_index=2)
        rack_hq4 = Rack(room_id=room_hq_b.id, name="HQ-B-R02", total_u_height=48,
                        max_power_kw=15.0, typical_power_kw=10.0, max_weight_kg=1500.0,
                        cooling_type="Liquid", pdu_a_id="PDU-A04", pdu_b_id="PDU-B04", order_index=3)
        rack_dr1 = Rack(room_id=room_dr_a.id, name="DR-A-R01", total_u_height=42,
                        max_power_kw=8.0, typical_power_kw=5.0, max_weight_kg=1000.0,
                        cooling_type="Air", pdu_a_id="PDU-DR-A01", pdu_b_id="PDU-DR-B01", order_index=0)
        rack_dr2 = Rack(room_id=room_dr_b.id, name="DR-B-R01", total_u_height=42,
                        max_power_kw=8.0, typical_power_kw=4.5, max_weight_kg=1000.0,
                        cooling_type="Air", pdu_a_id="PDU-DR-A02", pdu_b_id="PDU-DR-B02", order_index=1)
        rack_lab1 = Rack(room_id=room_lab_a.id, name="LAB-Z1-R01", total_u_height=24,
                         max_power_kw=4.0, typical_power_kw=2.0, max_weight_kg=600.0,
                         cooling_type="Air", pdu_a_id="PDU-LAB-A01", pdu_b_id=None, order_index=0)
        rack_lab2 = Rack(room_id=room_lab_a.id, name="LAB-Z1-R02", total_u_height=24,
                         max_power_kw=4.0, typical_power_kw=2.5, max_weight_kg=600.0,
                         cooling_type="Air", pdu_a_id="PDU-LAB-A02", pdu_b_id=None, order_index=1)
        rack_lab3 = Rack(room_id=room_lab_b.id, name="LAB-Z2-R01", total_u_height=36,
                         max_power_kw=6.0, typical_power_kw=3.5, max_weight_kg=900.0,
                         cooling_type="Air", pdu_a_id="PDU-LAB-B01", pdu_b_id="PDU-LAB-B02", order_index=2)
        
        # Historical Rack Scenario: Rack from a decommissioned site
        rack_hist1 = Rack(room_id=None, name="OLD-ZONE-R99", total_u_height=42,
                          last_site_name="Legacy Warehouse DC", is_deleted=False)
        
        db.add_all([rack_hq1, rack_hq2, rack_hq3, rack_hq4, rack_dr1, rack_dr2,
                    rack_lab1, rack_lab2, rack_lab3, rack_hist1])
        db.flush()

        # ── Devices ───────────────────────────────────────────────────────────
        print("Seeding Devices...")
        now = datetime.utcnow()
        dev1 = Device(
            name="hq-web-01", system="IT-Infra", type="Physical", status="Active",
            environment="Production", size_u=2, manufacturer="Dell", model="PowerEdge R750",
            serial_number="SN-WEB-001", asset_tag="AT-001", part_number="PN-R750-001",
            os_name="Ubuntu", os_version="22.04 LTS",
            primary_ip="10.0.1.10", management_ip="10.0.0.10", management_url="https://idrac-hq-web-01.internal",
            owner="ops-team", business_unit="Operations", vendor="Dell Technologies",
            purchase_order="PO-2024-001", cost_center="CC-OPS-001",
            purchase_date=datetime(2024, 1, 15), install_date=datetime(2024, 2, 1),
            warranty_end=datetime(2027, 1, 15), eol_date=datetime(2030, 1, 15),
            power_supply_count=2, power_max_w=750.0, power_typical_w=420.0, btu_hr=1432.0,
            depth="Full", tool_group="WebTier", fab_area="HQ", recipe_critical=False,
            metadata_json={"rack_position": "top", "notes": "Primary web server"},
            is_reservation=False, reservation_info={},
        )
        dev2 = Device(
            name="hq-web-02", system="IT-Infra", type="Physical", status="Active",
            environment="Production", size_u=2, manufacturer="Dell", model="PowerEdge R750",
            serial_number="SN-WEB-002", asset_tag="AT-002", part_number="PN-R750-001",
            os_name="Ubuntu", os_version="22.04 LTS",
            primary_ip="10.0.1.11", management_ip="10.0.0.11", management_url="https://idrac-hq-web-02.internal",
            owner="ops-team", business_unit="Operations", vendor="Dell Technologies",
            purchase_order="PO-2024-001", cost_center="CC-OPS-001",
            purchase_date=datetime(2024, 1, 15), install_date=datetime(2024, 2, 1),
            warranty_end=datetime(2027, 1, 15), eol_date=datetime(2030, 1, 15),
            power_supply_count=2, power_max_w=750.0, power_typical_w=400.0, btu_hr=1364.0,
            depth="Full", tool_group="WebTier", fab_area="HQ", recipe_critical=False,
            metadata_json={}, is_reservation=False, reservation_info={},
        )
        dev3 = Device(
            name="hq-db-01", system="SAP ERP", type="Physical", status="Active",
            environment="Production", size_u=4, manufacturer="HPE", model="ProLiant DL380 Gen10",
            serial_number="SN-DB-001", asset_tag="AT-003", part_number="PN-DL380-G10",
            os_name="RHEL", os_version="8.6",
            primary_ip="10.0.2.10", management_ip="10.0.0.20", management_url="https://ilo-hq-db-01.internal",
            owner="dba-team", business_unit="Engineering", vendor="HPE",
            purchase_order="PO-2023-015", cost_center="CC-ENG-002",
            purchase_date=datetime(2023, 6, 1), install_date=datetime(2023, 7, 1),
            warranty_end=datetime(2026, 6, 1), eol_date=datetime(2029, 6, 1),
            power_supply_count=2, power_max_w=1600.0, power_typical_w=950.0, btu_hr=3242.0,
            depth="Full", tool_group="DBTier", fab_area="HQ", recipe_critical=True,
            metadata_json={"cluster_role": "primary", "replication": "sync"},
            is_reservation=False, reservation_info={},
        )
        dev4 = Device(
            name="hq-db-02", system="SAP ERP", type="Physical", status="Active",
            environment="Production", size_u=4, manufacturer="HPE", model="ProLiant DL380 Gen10",
            serial_number="SN-DB-002", asset_tag="AT-004", part_number="PN-DL380-G10",
            os_name="RHEL", os_version="8.6",
            primary_ip="10.0.2.11", management_ip="10.0.0.21", management_url="https://ilo-hq-db-02.internal",
            owner="dba-team", business_unit="Engineering", vendor="HPE",
            purchase_order="PO-2023-015", cost_center="CC-ENG-002",
            purchase_date=datetime(2023, 6, 1), install_date=datetime(2023, 7, 1),
            warranty_end=datetime(2026, 6, 1), eol_date=datetime(2029, 6, 1),
            power_supply_count=2, power_max_w=1600.0, power_typical_w=900.0, btu_hr=3072.0,
            depth="Full", tool_group="DBTier", fab_area="HQ", recipe_critical=True,
            metadata_json={"cluster_role": "replica"},
            is_reservation=False, reservation_info={},
        )
        dev5 = Device(
            name="hq-sw-core-01", system="IT-Infra", type="Switch", status="Active",
            environment="Production", size_u=2, manufacturer="Cisco", model="Nexus 9300",
            serial_number="SN-SW-001", asset_tag="AT-005", part_number="N9K-C9336C-FX2",
            os_name="NX-OS", os_version="9.3.10",
            primary_ip="10.0.0.1", management_ip="10.0.0.1", management_url="https://hq-sw-core-01.internal",
            owner="netops", business_unit="Operations", vendor="Cisco",
            purchase_order="PO-2023-020", cost_center="CC-OPS-003",
            purchase_date=datetime(2023, 3, 1), install_date=datetime(2023, 4, 1),
            warranty_end=datetime(2026, 3, 1), eol_date=datetime(2028, 3, 1),
            power_supply_count=2, power_max_w=1100.0, power_typical_w=600.0, btu_hr=2048.0,
            depth="Full", tool_group="Network", fab_area="HQ", recipe_critical=True,
            metadata_json={"vlan_count": 48, "uplink_speed": "100G"},
            is_reservation=False, reservation_info={},
        )
        dev6 = Device(
            name="hq-fw-01", system="IT-Infra", type="Firewall", status="Active",
            environment="Production", size_u=2, manufacturer="Palo Alto", model="PA-5250",
            serial_number="SN-FW-001", asset_tag="AT-006", part_number="PAN-PA-5250",
            os_name="PAN-OS", os_version="11.0.2",
            primary_ip="10.0.0.254", management_ip="10.0.0.253", management_url="https://hq-fw-01.internal",
            owner="security-team", business_unit="Security", vendor="Palo Alto Networks",
            purchase_order="PO-2023-025", cost_center="CC-SEC-001",
            purchase_date=datetime(2023, 5, 1), install_date=datetime(2023, 5, 15),
            warranty_end=datetime(2026, 5, 1), eol_date=datetime(2029, 5, 1),
            power_supply_count=2, power_max_w=800.0, power_typical_w=450.0, btu_hr=1535.0,
            depth="Full", tool_group="Security", fab_area="HQ", recipe_critical=True,
            metadata_json={"ha_mode": "active-passive", "threat_prevention": True},
            is_reservation=False, reservation_info={},
        )
        dev7 = Device(
            name="hq-stor-01", system="IT-Infra", type="Storage", status="Active",
            environment="Production", size_u=4, manufacturer="NetApp", model="AFF A400",
            serial_number="SN-STOR-001", asset_tag="AT-007", part_number="AFF-A400",
            os_name="ONTAP", os_version="9.12.1",
            primary_ip="10.0.3.10", management_ip="10.0.0.30", management_url="https://hq-stor-01.internal",
            owner="storage-team", business_unit="Operations", vendor="NetApp",
            purchase_order="PO-2022-008", cost_center="CC-OPS-002",
            purchase_date=datetime(2022, 9, 1), install_date=datetime(2022, 10, 1),
            warranty_end=datetime(2025, 9, 1), eol_date=datetime(2028, 9, 1),
            power_supply_count=4, power_max_w=2000.0, power_typical_w=1200.0, btu_hr=4096.0,
            depth="Full", tool_group="Storage", fab_area="HQ", recipe_critical=True,
            metadata_json={"usable_tb": 200, "protocol": "NFS/iSCSI"},
            is_reservation=False, reservation_info={},
        )
        dev8 = Device(
            name="hq-vm-host-01", system="DevOps", type="Physical", status="Active",
            environment="Production", size_u=2, manufacturer="Dell", model="PowerEdge R650",
            serial_number="SN-VM-001", asset_tag="AT-008", part_number="PN-R650-001",
            os_name="VMware ESXi", os_version="8.0U2",
            primary_ip="10.0.4.10", management_ip="10.0.0.40", management_url="https://idrac-hq-vm-01.internal",
            owner="vmware-team", business_unit="Engineering", vendor="Dell Technologies",
            purchase_order="PO-2024-005", cost_center="CC-ENG-001",
            purchase_date=datetime(2024, 3, 1), install_date=datetime(2024, 3, 15),
            warranty_end=datetime(2027, 3, 1), eol_date=datetime(2030, 3, 1),
            power_supply_count=2, power_max_w=800.0, power_typical_w=500.0, btu_hr=1706.0,
            depth="Half", tool_group="Virtualization", fab_area="HQ", recipe_critical=False,
            metadata_json={"vm_count": 32, "cluster": "hq-vsan-01"},
            is_reservation=False, reservation_info={},
        )
        dev9 = Device(
            name="hq-lb-01", system="IT-Infra", type="Load Balancer", status="Active",
            environment="Production", size_u=2, manufacturer="F5", model="BIG-IP i5800",
            serial_number="SN-LB-001", asset_tag="AT-009", part_number="F5-BIG-I5800",
            os_name="TMOS", os_version="17.1.0",
            primary_ip="10.0.1.1", management_ip="10.0.0.50", management_url="https://hq-lb-01.internal",
            owner="netops", business_unit="Operations", vendor="F5 Networks",
            purchase_order="PO-2023-030", cost_center="CC-OPS-004",
            purchase_date=datetime(2023, 8, 1), install_date=datetime(2023, 8, 20),
            warranty_end=datetime(2026, 8, 1), eol_date=datetime(2029, 8, 1),
            power_supply_count=2, power_max_w=600.0, power_typical_w=350.0, btu_hr=1195.0,
            depth="Full", tool_group="Network", fab_area="HQ", recipe_critical=True,
            metadata_json={"virtual_servers": 12, "ssl_offload": True},
            is_reservation=False, reservation_info={},
        )
        dev10 = Device(
            name="dr-web-01", system="IT-Infra", type="Physical", status="Standby",
            environment="DR", size_u=2, manufacturer="Dell", model="PowerEdge R750",
            serial_number="SN-DR-WEB-001", asset_tag="AT-010", part_number="PN-R750-001",
            os_name="Ubuntu", os_version="22.04 LTS",
            primary_ip="172.16.1.10", management_ip="172.16.0.10", management_url="https://idrac-dr-web-01.internal",
            owner="ops-team", business_unit="Operations", vendor="Dell Technologies",
            purchase_order="PO-2024-002", cost_center="CC-OPS-001",
            purchase_date=datetime(2024, 1, 15), install_date=datetime(2024, 2, 10),
            warranty_end=datetime(2027, 1, 15), eol_date=datetime(2030, 1, 15),
            power_supply_count=2, power_max_w=750.0, power_typical_w=380.0, btu_hr=1297.0,
            depth="Full", tool_group="WebTier", fab_area="DR", recipe_critical=False,
            metadata_json={"failover_priority": 1},
            is_reservation=False, reservation_info={},
        )
        dev11 = Device(
            name="dr-db-01", system="SAP ERP", type="Physical", status="Standby",
            environment="DR", size_u=4, manufacturer="HPE", model="ProLiant DL380 Gen10",
            serial_number="SN-DR-DB-001", asset_tag="AT-011", part_number="PN-DL380-G10",
            os_name="RHEL", os_version="8.6",
            primary_ip="172.16.2.10", management_ip="172.16.0.20", management_url="https://ilo-dr-db-01.internal",
            owner="dba-team", business_unit="Engineering", vendor="HPE",
            purchase_order="PO-2023-016", cost_center="CC-ENG-002",
            purchase_date=datetime(2023, 6, 1), install_date=datetime(2023, 7, 15),
            warranty_end=datetime(2026, 6, 1), eol_date=datetime(2029, 6, 1),
            power_supply_count=2, power_max_w=1600.0, power_typical_w=880.0, btu_hr=3003.0,
            depth="Full", tool_group="DBTier", fab_area="DR", recipe_critical=True,
            metadata_json={"cluster_role": "dr-replica"},
            is_reservation=False, reservation_info={},
        )
        dev12 = Device(
            name="lab-dev-01", system="DevOps", type="Physical", status="Active",
            environment="Dev", size_u=1, manufacturer="Supermicro", model="SYS-5019C-MR",
            serial_number="SN-LAB-001", asset_tag="AT-012", part_number="SYS-5019C",
            os_name="Ubuntu", os_version="22.04 LTS",
            primary_ip="192.168.1.10", management_ip="192.168.0.10", management_url=None,
            owner="dev-team", business_unit="Engineering", vendor="Supermicro",
            purchase_order="PO-2024-010", cost_center="CC-ENG-003",
            purchase_date=datetime(2024, 6, 1), install_date=datetime(2024, 6, 10),
            warranty_end=datetime(2027, 6, 1), eol_date=datetime(2031, 6, 1),
            power_supply_count=1, power_max_w=300.0, power_typical_w=180.0, btu_hr=614.0,
            depth="Half", tool_group="DevEnv", fab_area="Lab", recipe_critical=False,
            metadata_json={"purpose": "CI runner"},
            is_reservation=False, reservation_info={},
        )
        dev13 = Device(
            name="lab-k8s-01", system="DevOps", type="Physical", status="Active",
            environment="Dev", size_u=1, manufacturer="Supermicro", model="SYS-5019C-MR",
            serial_number="SN-LAB-002", asset_tag="AT-013", part_number="SYS-5019C",
            os_name="Ubuntu", os_version="22.04 LTS",
            primary_ip="192.168.1.11", management_ip="192.168.0.11", management_url=None,
            owner="dev-team", business_unit="Engineering", vendor="Supermicro",
            purchase_order="PO-2024-010", cost_center="CC-ENG-003",
            purchase_date=datetime(2024, 6, 1), install_date=datetime(2024, 6, 10),
            warranty_end=datetime(2027, 6, 1), eol_date=datetime(2031, 6, 1),
            power_supply_count=1, power_max_w=300.0, power_typical_w=200.0, btu_hr=682.0,
            depth="Half", tool_group="DevEnv", fab_area="Lab", recipe_critical=False,
            metadata_json={"k8s_role": "control-plane"},
            is_reservation=False, reservation_info={},
        )
        dev14 = Device(
            name="hq-vm-host-02", system="DevOps", type="Physical", status="Maintenance",
            environment="Production", size_u=2, manufacturer="Dell", model="PowerEdge R650",
            serial_number="SN-VM-002", asset_tag="AT-014", part_number="PN-R650-001",
            os_name="VMware ESXi", os_version="8.0U1",
            primary_ip="10.0.4.11", management_ip="10.0.0.41", management_url="https://idrac-hq-vm-02.internal",
            owner="vmware-team", business_unit="Engineering", vendor="Dell Technologies",
            purchase_order="PO-2024-005", cost_center="CC-ENG-001",
            purchase_date=datetime(2024, 3, 1), install_date=datetime(2024, 3, 15),
            warranty_end=datetime(2027, 3, 1), eol_date=datetime(2030, 3, 1),
            power_supply_count=2, power_max_w=800.0, power_typical_w=520.0, btu_hr=1774.0,
            depth="Half", tool_group="Virtualization", fab_area="HQ", recipe_critical=False,
            metadata_json={"vm_count": 28, "cluster": "hq-vsan-01"},
            is_reservation=False, reservation_info={},
        )
        dev15 = Device(
            name="hq-backup-01", system="IT-Infra", type="Storage", status="Active",
            environment="Production", size_u=4, manufacturer="Veeam/Dell", model="PowerProtect DD3300",
            serial_number="SN-BKP-001", asset_tag="AT-015", part_number="DD3300",
            os_name="DD OS", os_version="7.9",
            primary_ip="10.0.3.20", management_ip="10.0.0.31", management_url="https://hq-backup-01.internal",
            owner="backup-team", business_unit="Operations", vendor="Dell Technologies",
            purchase_order="PO-2023-040", cost_center="CC-OPS-002",
            purchase_date=datetime(2023, 10, 1), install_date=datetime(2023, 10, 20),
            warranty_end=datetime(2026, 10, 1), eol_date=datetime(2029, 10, 1),
            power_supply_count=2, power_max_w=1000.0, power_typical_w=600.0, btu_hr=2048.0,
            depth="Full", tool_group="Backup", fab_area="HQ", recipe_critical=False,
            metadata_json={"usable_tb": 96, "dedup_ratio": "5:1"},
            is_reservation=False, reservation_info={},
        )
        dev16 = Device(
            name="hq-reserved-slot-01", system="IT-Infra", type="Physical", status="Planned",
            environment="Production", size_u=2, manufacturer=None, model=None,
            serial_number=None, asset_tag="AT-RSVD-001", part_number=None,
            os_name=None, os_version=None,
            primary_ip=None, management_ip=None, management_url=None,
            owner="ops-team", business_unit="Operations", vendor=None,
            purchase_order=None, cost_center="CC-OPS-001",
            purchase_date=None, install_date=None, warranty_end=None, eol_date=None,
            power_supply_count=2, power_max_w=800.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group=None, fab_area="HQ", recipe_critical=False,
            metadata_json={},
            is_reservation=True,
            reservation_info={"reserved_by": "ops-team", "reason": "Future web server expansion", "until": "2026-06-01"},
        )
        dev17 = Device(
            name="hq-sw-access-01", system="IT-Infra", type="Switch", status="Active",
            environment="Production", size_u=1, manufacturer="Cisco", model="Catalyst 9300",
            serial_number="SN-SW-002", asset_tag="AT-017", part_number="C9300-48P-A",
            os_name="IOS-XE", os_version="17.9.4",
            primary_ip="10.0.0.5", management_ip="10.0.0.5", management_url="https://hq-sw-access-01.internal",
            owner="netops", business_unit="Operations", vendor="Cisco",
            purchase_order="PO-2023-022", cost_center="CC-OPS-003",
            purchase_date=datetime(2023, 3, 1), install_date=datetime(2023, 4, 5),
            warranty_end=datetime(2026, 3, 1), eol_date=datetime(2028, 3, 1),
            power_supply_count=2, power_max_w=715.0, power_typical_w=400.0, btu_hr=1365.0,
            depth="Full", tool_group="Network", fab_area="HQ", recipe_critical=False,
            metadata_json={"poe_budget_w": 740},
            is_reservation=False, reservation_info={},
        )
        dev18 = Device(
            name="hq-hr-app-01", system="HR-Core", type="Virtual", status="Active",
            environment="Production", size_u=1, manufacturer="VMware", model="vSphere VM",
            serial_number="SN-VM-HR-001", asset_tag="AT-018", part_number=None,
            os_name="Windows Server", os_version="2022",
            primary_ip="10.0.5.10", management_ip=None, management_url="https://hr-app-01.internal",
            owner="hr-team", business_unit="HR", vendor="Oracle",
            purchase_order="PO-2023-050", cost_center="CC-HR-001",
            purchase_date=datetime(2023, 1, 1), install_date=datetime(2023, 1, 20),
            warranty_end=None, eol_date=datetime(2027, 1, 1),
            power_supply_count=0, power_max_w=0.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="HRApps", fab_area="HQ", recipe_critical=False,
            metadata_json={"vcpu": 8, "ram_gb": 32},
            is_reservation=False, reservation_info={},
        )
        dev19 = Device(
            name="lab-stg-01", system="Sales-B2B", type="Physical", status="Active",
            environment="Staging", size_u=2, manufacturer="Dell", model="PowerEdge R640",
            serial_number="SN-STG-001", asset_tag="AT-019", part_number="PN-R640-001",
            os_name="Ubuntu", os_version="20.04 LTS",
            primary_ip="192.168.2.10", management_ip="192.168.0.20", management_url=None,
            owner="qa-team", business_unit="Sales", vendor="Dell Technologies",
            purchase_order="PO-2023-060", cost_center="CC-SALES-001",
            purchase_date=datetime(2023, 4, 1), install_date=datetime(2023, 4, 20),
            warranty_end=datetime(2026, 4, 1), eol_date=datetime(2029, 4, 1),
            power_supply_count=2, power_max_w=600.0, power_typical_w=350.0, btu_hr=1195.0,
            depth="Half", tool_group="SalesTier", fab_area="Lab", recipe_critical=False,
            metadata_json={"purpose": "staging api server"},
            is_reservation=False, reservation_info={},
        )
        dev20 = Device(
            name="hq-mon-01", system="IT-Infra", type="Virtual", status="Active",
            environment="Production", size_u=1, manufacturer="VMware", model="vSphere VM",
            serial_number="SN-VM-MON-001", asset_tag="AT-020", part_number=None,
            os_name="Ubuntu", os_version="22.04 LTS",
            primary_ip="10.0.6.10", management_ip=None, management_url="https://grafana.internal",
            owner="ops-team", business_unit="Operations", vendor="Grafana Labs",
            purchase_order=None, cost_center="CC-OPS-001",
            purchase_date=None, install_date=datetime(2023, 9, 1),
            warranty_end=None, eol_date=None,
            power_supply_count=0, power_max_w=0.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="Observability", fab_area="HQ", recipe_critical=False,
            metadata_json={"vcpu": 4, "ram_gb": 16, "stack": "Prometheus+Grafana"},
            is_reservation=False, reservation_info={},
        )
        dev21 = Device(
            name="hq-db-03", system="SAP ERP", type="Physical", status="Planned",
            environment="Production", size_u=4, manufacturer="HPE", model="ProLiant DL380 Gen10",
            serial_number="SN-DB-003", asset_tag="AT-021", part_number="PN-DL380-G10",
            os_name="RHEL", os_version="8.6",
            primary_ip="10.0.2.12", management_ip="10.0.0.22", management_url="https://ilo-hq-db-03.internal",
            owner="dba-team", business_unit="Engineering", vendor="HPE",
            purchase_order="PO-2024-088", cost_center="CC-ENG-002",
            purchase_date=datetime(2024, 3, 1), install_date=None,
            warranty_end=datetime(2027, 3, 1), eol_date=datetime(2030, 3, 1),
            power_supply_count=2, power_max_w=1600.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="DBTier", fab_area="HQ", recipe_critical=True,
            metadata_json={"cluster_role": "secondary-replica"},
            is_reservation=False, reservation_info={},
        )
        dev22 = Device(
            name="hq-sw-core-02", system="IT-Infra", type="Switch", status="Active",
            environment="Production", size_u=2, manufacturer="Cisco", model="Nexus 9300",
            serial_number="SN-SW-003", asset_tag="AT-022", part_number="N9K-C9336C-FX2",
            os_name="NX-OS", os_version="9.3.10",
            primary_ip="10.0.0.2", management_ip="10.0.0.2", management_url="https://hq-sw-core-02.internal",
            owner="netops", business_unit="Operations", vendor="Cisco",
            purchase_order="PO-2023-020", cost_center="CC-OPS-003",
            purchase_date=datetime(2023, 3, 1), install_date=datetime(2023, 4, 1),
            warranty_end=datetime(2026, 3, 1), eol_date=datetime(2028, 3, 1),
            power_supply_count=2, power_max_w=1100.0, power_typical_w=600.0, btu_hr=2048.0,
            depth="Full", tool_group="Network", fab_area="HQ", recipe_critical=True,
            metadata_json={"vlan_count": 48, "vpc_domain": 10},
            is_reservation=False, reservation_info={},
        )
        dev23 = Device(
            name="hq-stor-02", system="IT-Infra", type="Storage", status="Active",
            environment="Production", size_u=4, manufacturer="NetApp", model="AFF A400",
            serial_number="SN-STOR-002", asset_tag="AT-023", part_number="AFF-A400",
            os_name="ONTAP", os_version="9.12.1",
            primary_ip="10.0.3.11", management_ip="10.0.0.32", management_url="https://hq-stor-02.internal",
            owner="storage-team", business_unit="Operations", vendor="NetApp",
            purchase_order="PO-2022-008", cost_center="CC-OPS-002",
            purchase_date=datetime(2022, 9, 1), install_date=datetime(2022, 10, 1),
            warranty_end=datetime(2025, 9, 1), eol_date=datetime(2028, 9, 1),
            power_supply_count=4, power_max_w=2000.0, power_typical_w=1200.0, btu_hr=4096.0,
            depth="Full", tool_group="Storage", fab_area="HQ", recipe_critical=True,
            metadata_json={"usable_tb": 200, "ha_pair": "hq-stor-01"},
            is_reservation=False, reservation_info={},
        )
        dev24 = Device(
            name="hq-jump-01", system="IT-Infra", type="Virtual", status="Active",
            environment="Production", size_u=1, manufacturer="VMware", model="vSphere VM",
            serial_number="SN-VM-JUMP-01", asset_tag="AT-024", part_number=None,
            os_name="Windows Server", os_version="2019",
            primary_ip="10.0.0.100", management_ip=None, management_url=None,
            owner="ops-team", business_unit="Operations", vendor="Microsoft",
            purchase_order=None, cost_center="CC-OPS-001",
            purchase_date=None, install_date=datetime(2023, 1, 15),
            warranty_end=None, eol_date=datetime(2029, 1, 1),
            power_supply_count=0, power_max_w=0.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="Admin", fab_area="HQ", recipe_critical=False,
            metadata_json={"rdp_enabled": True},
            is_reservation=False, reservation_info={},
        )
        dev25 = Device(
            name="hq-log-01", system="IT-Infra", type="Virtual", status="Active",
            environment="Production", size_u=1, manufacturer="VMware", model="vSphere VM",
            serial_number="SN-VM-LOG-01", asset_tag="AT-025", part_number=None,
            os_name="Ubuntu", os_version="22.04 LTS",
            primary_ip="10.0.6.20", management_ip=None, management_url="https://elk.internal",
            owner="security-team", business_unit="Security", vendor="Elastic",
            purchase_order=None, cost_center="CC-SEC-001",
            purchase_date=None, install_date=datetime(2023, 11, 1),
            warranty_end=None, eol_date=None,
            power_supply_count=0, power_max_w=0.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="Observability", fab_area="HQ", recipe_critical=False,
            metadata_json={"stack": "Elasticsearch+Kibana", "retention": "90d"},
            is_reservation=False, reservation_info={},
        )
        dev26 = Device(
            name="hq-vcenter-01", system="DevOps", type="Virtual", status="Active",
            environment="Production", size_u=1, manufacturer="VMware", model="VCSA",
            serial_number="SN-VM-VC-01", asset_tag="AT-026", part_number=None,
            os_name="Photon OS", os_version="4.0",
            primary_ip="10.0.0.10", management_ip=None, management_url="https://vcenter.internal",
            owner="vmware-team", business_unit="Engineering", vendor="VMware",
            purchase_order=None, cost_center="CC-ENG-001",
            purchase_date=None, install_date=datetime(2024, 3, 1),
            warranty_end=None, eol_date=None,
            power_supply_count=0, power_max_w=0.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="Virtualization", fab_area="HQ", recipe_critical=True,
            metadata_json={"managed_hosts": 12},
            is_reservation=False, reservation_info={},
        )
        dev27 = Device(
            name="hq-dns-01", system="IT-Infra", type="Virtual", status="Active",
            environment="Production", size_u=1, manufacturer="VMware", model="vSphere VM",
            serial_number="SN-VM-DNS-01", asset_tag="AT-027", part_number=None,
            os_name="RHEL", os_version="9.2",
            primary_ip="10.0.0.53", management_ip=None, management_url=None,
            owner="ops-team", business_unit="Operations", vendor="Red Hat",
            purchase_order=None, cost_center="CC-OPS-001",
            purchase_date=None, install_date=datetime(2023, 1, 10),
            warranty_end=None, eol_date=None,
            power_supply_count=0, power_max_w=0.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="CoreServices", fab_area="HQ", recipe_critical=True,
            metadata_json={"role": "primary-dns"},
            is_reservation=False, reservation_info={},
        )
        dev28 = Device(
            name="hq-dns-02", system="IT-Infra", type="Virtual", status="Active",
            environment="Production", size_u=1, manufacturer="VMware", model="vSphere VM",
            serial_number="SN-VM-DNS-02", asset_tag="AT-028", part_number=None,
            os_name="RHEL", os_version="9.2",
            primary_ip="10.0.0.54", management_ip=None, management_url=None,
            owner="ops-team", business_unit="Operations", vendor="Red Hat",
            purchase_order=None, cost_center="CC-OPS-001",
            purchase_date=None, install_date=datetime(2023, 1, 10),
            warranty_end=None, eol_date=None,
            power_supply_count=0, power_max_w=0.0, power_typical_w=0.0, btu_hr=0.0,
            depth="Full", tool_group="CoreServices", fab_area="HQ", recipe_critical=True,
            metadata_json={"role": "secondary-dns"},
            is_reservation=False, reservation_info={},
        )
        dev29 = Device(
            name="hq-ntp-01", system="IT-Infra", type="Physical", status="Active",
            environment="Production", size_u=1, manufacturer="Meinberg", model="LANTIME M3000",
            serial_number="SN-NTP-01", asset_tag="AT-029", part_number="M3000-S",
            os_name="LTOS", os_version="7.0",
            primary_ip="10.0.0.123", management_ip="10.0.0.124", management_url="https://hq-ntp-01.internal",
            owner="ops-team", business_unit="Operations", vendor="Meinberg",
            purchase_order="PO-2022-099", cost_center="CC-OPS-001",
            purchase_date=datetime(2022, 5, 1), install_date=datetime(2022, 6, 1),
            warranty_end=datetime(2025, 5, 1), eol_date=datetime(2032, 5, 1),
            power_supply_count=2, power_max_w=100.0, power_typical_w=45.0, btu_hr=153.0,
            depth="Half", tool_group="CoreServices", fab_area="HQ", recipe_critical=True,
            metadata_json={"source": "GPS", "stratum": 1},
            is_reservation=False, reservation_info={},
        )
        devices = [dev1, dev2, dev3, dev4, dev5, dev6, dev7, dev8, dev9, dev10,
                   dev11, dev12, dev13, dev14, dev15, dev16, dev17, dev18, dev19, dev20,
                   dev21, dev22, dev23, dev24, dev25, dev26, dev27, dev28, dev29]
        db.add_all(devices)
        db.flush()

        # ── DeviceLocations ───────────────────────────────────────────────────
        print("Seeding DeviceLocations...")
        locations = [
            DeviceLocation(device_id=dev1.id,  rack_id=rack_hq1.id, start_unit=40, size_u=2, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev2.id,  rack_id=rack_hq1.id, start_unit=38, size_u=2, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev3.id,  rack_id=rack_hq2.id, start_unit=38, size_u=4, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev4.id,  rack_id=rack_hq2.id, start_unit=34, size_u=4, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev5.id,  rack_id=rack_hq3.id, start_unit=41, size_u=2, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev6.id,  rack_id=rack_hq3.id, start_unit=39, size_u=2, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev7.id,  rack_id=rack_hq4.id, start_unit=44, size_u=4, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev8.id,  rack_id=rack_hq1.id, start_unit=36, size_u=2, orientation="Front", depth="Half"),
            DeviceLocation(device_id=dev9.id,  rack_id=rack_hq3.id, start_unit=37, size_u=2, orientation="Back",  depth="Half"),
            DeviceLocation(device_id=dev10.id, rack_id=rack_dr1.id, start_unit=40, size_u=2, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev11.id, rack_id=rack_dr1.id, start_unit=36, size_u=4, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev12.id, rack_id=rack_lab1.id, start_unit=23, size_u=1, orientation="Front", depth="Half"),
            DeviceLocation(device_id=dev13.id, rack_id=rack_lab1.id, start_unit=22, size_u=1, orientation="Front", depth="Half"),
            DeviceLocation(device_id=dev14.id, rack_id=rack_hq2.id, start_unit=30, size_u=2, orientation="Front", depth="Half"),
            DeviceLocation(device_id=dev15.id, rack_id=rack_hq4.id, start_unit=40, size_u=4, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev17.id, rack_id=rack_hq3.id, start_unit=35, size_u=1, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev19.id, rack_id=rack_lab3.id, start_unit=34, size_u=2, orientation="Front", depth="Half"),
            DeviceLocation(device_id=dev22.id, rack_id=rack_hq3.id, start_unit=33, size_u=2, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev23.id, rack_id=rack_hq4.id, start_unit=36, size_u=4, orientation="Front", depth="Full"),
            DeviceLocation(device_id=dev29.id, rack_id=rack_hq1.id, start_unit=35, size_u=1, orientation="Front", depth="Half"),
        ]
        db.add_all(locations)
        db.flush()

        # ── HardwareComponents ────────────────────────────────────────────────
        print("Seeding HardwareComponents...")
        hw = [
            HardwareComponent(device_id=dev1.id,  category="CPU",    name="Intel Xeon Gold 6338", manufacturer="Intel",   specs="32C/64T 2.0GHz", count=2, serial_number="CPU-WEB01-A"),
            HardwareComponent(device_id=dev1.id,  category="Memory", name="DDR4 ECC RDIMM",       manufacturer="Samsung", specs="32GB 3200MHz",   count=16, serial_number=None),
            HardwareComponent(device_id=dev1.id,  category="SSD",    name="PM9A3 NVMe",           manufacturer="Samsung", specs="1.92TB U.2",     count=2, serial_number="SSD-WEB01-1"),
            HardwareComponent(device_id=dev3.id,  category="CPU",    name="Intel Xeon Platinum 8380", manufacturer="Intel", specs="40C/80T 2.3GHz", count=2, serial_number="CPU-DB01-A"),
            HardwareComponent(device_id=dev3.id,  category="Memory", name="DDR4 ECC LRDIMM",      manufacturer="Micron",  specs="64GB 3200MHz",   count=16, serial_number=None),
            HardwareComponent(device_id=dev3.id,  category="SSD",    name="PM9A3 NVMe",           manufacturer="Samsung", specs="3.84TB U.2",     count=4, serial_number="SSD-DB01-1"),
            HardwareComponent(device_id=dev3.id,  category="NIC",    name="ConnectX-6 Dx",        manufacturer="Mellanox",specs="2x 25GbE",       count=1, serial_number="NIC-DB01-1"),
            HardwareComponent(device_id=dev5.id,  category="Card",   name="100G QSFP28 Module",   manufacturer="Cisco",   specs="SR4 100GbE",     count=32, serial_number=None),
            HardwareComponent(device_id=dev7.id,  category="HDD",    name="SAS HDD 7.2k",         manufacturer="Seagate", specs="12TB SAS 12G",   count=24, serial_number=None),
            HardwareComponent(device_id=dev7.id,  category="SSD",    name="DS224C Flash",         manufacturer="NetApp",  specs="3.8TB NVMe",     count=4, serial_number="FLASH-STOR-1"),
            HardwareComponent(device_id=dev8.id,  category="CPU",    name="Intel Xeon Gold 6330", manufacturer="Intel",   specs="28C/56T 2.0GHz", count=2, serial_number="CPU-VM01-A"),
            HardwareComponent(device_id=dev8.id,  category="Memory", name="DDR4 ECC RDIMM",       manufacturer="Hynix",   specs="32GB 3200MHz",   count=16, serial_number=None),
            HardwareComponent(device_id=dev12.id, category="CPU",    name="Intel Core i9-13900",  manufacturer="Intel",   specs="24C 5.6GHz",     count=1, serial_number="CPU-LAB01-A"),
            HardwareComponent(device_id=dev12.id, category="Memory", name="DDR5 UDIMM",           manufacturer="Kingston",specs="32GB 5600MHz",   count=2, serial_number=None),
            HardwareComponent(device_id=dev15.id, category="HDD",    name="NL-SAS HDD",           manufacturer="WD",      specs="16TB SATA",      count=12, serial_number=None),
        ]
        db.add_all(hw)
        db.flush()

        # ── DeviceSoftware ────────────────────────────────────────────────────
        print("Seeding DeviceSoftware...")
        sw = [
            DeviceSoftware(device_id=dev1.id, category="Web Server", name="Nginx",     version="1.25.3", install_date=datetime(2024, 2, 5),  purpose="HTTP reverse proxy", notes="TLS termination + LB"),
            DeviceSoftware(device_id=dev1.id, category="Agent",      name="Prometheus Node Exporter", version="1.7.0", install_date=datetime(2024, 2, 5), purpose="Metrics", notes=None),
            DeviceSoftware(device_id=dev3.id, category="Database",   name="PostgreSQL", version="15.4", install_date=datetime(2023, 7, 2),  purpose="Primary OLTP DB", notes="SAP ERP backend"),
            DeviceSoftware(device_id=dev3.id, category="Agent",      name="pg_exporter", version="0.13.0", install_date=datetime(2023, 7, 5), purpose="DB metrics", notes=None),
            DeviceSoftware(device_id=dev4.id, category="Database",   name="PostgreSQL", version="15.4", install_date=datetime(2023, 7, 2),  purpose="Replica OLTP DB", notes="Streaming replication from hq-db-01"),
            DeviceSoftware(device_id=dev8.id, category="Hypervisor", name="VMware ESXi", version="8.0U2", install_date=datetime(2024, 3, 15), purpose="Virtualization", notes="vSAN cluster node"),
            DeviceSoftware(device_id=dev8.id, category="Agent",      name="vSphere Agent", version="8.0.2", install_date=datetime(2024, 3, 15), purpose="vCenter agent", notes=None),
            DeviceSoftware(device_id=dev12.id, category="Runtime",   name="Docker Engine", version="25.0.3", install_date=datetime(2024, 6, 10), purpose="Container runtime", notes="CI/CD runner"),
            DeviceSoftware(device_id=dev12.id, category="CI",        name="GitLab Runner", version="16.9.0", install_date=datetime(2024, 6, 11), purpose="CI pipeline executor", notes="Registered to gitlab.internal"),
            DeviceSoftware(device_id=dev13.id, category="Orchestration", name="kubeadm", version="1.29.2", install_date=datetime(2024, 6, 12), purpose="K8s control plane", notes="Lab cluster"),
            DeviceSoftware(device_id=dev15.id, category="Backup",    name="DDVE",       version="7.9.0.30", install_date=datetime(2023, 10, 20), purpose="Backup target", notes="Veeam integration"),
            DeviceSoftware(device_id=dev18.id, category="ERP",       name="Oracle HCM Cloud Agent", version="23D", install_date=datetime(2023, 1, 20), purpose="HR system agent", notes="On-prem connector"),
            DeviceSoftware(device_id=dev20.id, category="Monitoring", name="Prometheus", version="2.50.1", install_date=datetime(2023, 9, 1), purpose="Metrics collection", notes=None),
            DeviceSoftware(device_id=dev20.id, category="Monitoring", name="Grafana",   version="10.3.1", install_date=datetime(2023, 9, 1), purpose="Dashboards",        notes="Central observability"),
            DeviceSoftware(device_id=dev9.id,  category="LB",        name="TMOS",       version="17.1.0", install_date=datetime(2023, 8, 20), purpose="Load balancer OS", notes=None),
        ]
        db.add_all(sw)
        db.flush()

        # ── NetworkInterfaces ─────────────────────────────────────────────────
        print("Seeding NetworkInterfaces...")
        nics = [
            # dev1 (hq-web-01): Multi-homed Office & Private L2
            NetworkInterface(device_id=dev1.id,  name="eth0", mac_address="00:11:22:33:44:01", ip_address="10.0.1.10",  vlan_id=10,  link_speed_gbps=10), # Office
            NetworkInterface(device_id=dev1.id,  name="eth1", mac_address="00:11:22:33:44:02", ip_address="192.168.1.10", vlan_id=100, link_speed_gbps=1),  # Private L2
            NetworkInterface(device_id=dev1.id,  name="mgmt", mac_address="00:11:22:33:44:33", ip_address="10.0.0.10",  vlan_id=1,   link_speed_gbps=1),  # OOB
            
            # dev2 (hq-web-02)
            NetworkInterface(device_id=dev2.id,  name="eth0", mac_address="00:11:22:33:44:03", ip_address="10.0.1.11",  vlan_id=10,  link_speed_gbps=10),
            NetworkInterface(device_id=dev2.id,  name="eth1", mac_address="00:11:22:33:44:04", ip_address="192.168.1.11", vlan_id=100, link_speed_gbps=1),
            
            # dev3 (hq-db-01): Multi-homed DB with Storage segment
            NetworkInterface(device_id=dev3.id,  name="bond0", mac_address="00:11:22:33:44:05", ip_address="10.0.2.10", vlan_id=20,  link_speed_gbps=25), # Prod
            NetworkInterface(device_id=dev3.id,  name="eth-mgmt", mac_address="00:11:22:33:44:06", ip_address="10.0.0.20", vlan_id=1, link_speed_gbps=1),
            NetworkInterface(device_id=dev3.id,  name="eth-iscsi", mac_address="00:11:22:33:44:99", ip_address="10.0.3.100", vlan_id=30, link_speed_gbps=25), # Storage
            NetworkInterface(device_id=dev3.id,  name="eth-repl", mac_address="00:11:22:33:44:88", ip_address="192.168.1.20", vlan_id=100, link_speed_gbps=10), # DB Replication
            
            NetworkInterface(device_id=dev4.id,  name="bond0", mac_address="00:11:22:33:44:07", ip_address="10.0.2.11", vlan_id=20,  link_speed_gbps=25),
            NetworkInterface(device_id=dev5.id,  name="mgmt0", mac_address="00:11:22:33:44:09", ip_address="10.0.0.1",  vlan_id=1,   link_speed_gbps=1),
            NetworkInterface(device_id=dev6.id,  name="mgmt",  mac_address="00:11:22:33:44:11", ip_address="10.0.0.254",vlan_id=1,   link_speed_gbps=1),
            NetworkInterface(device_id=dev7.id,  name="e0a",   mac_address="00:11:22:33:44:13", ip_address="10.0.3.10", vlan_id=30,  link_speed_gbps=25),
            NetworkInterface(device_id=dev8.id,  name="vmnic0",mac_address="00:11:22:33:44:15", ip_address="10.0.4.10", vlan_id=40,  link_speed_gbps=25),
            NetworkInterface(device_id=dev9.id,  name="mgmt",  mac_address="00:11:22:33:44:17", ip_address="10.0.0.50", vlan_id=1,   link_speed_gbps=1),
            NetworkInterface(device_id=dev10.id, name="eth0",  mac_address="00:11:22:33:44:19", ip_address="172.16.1.10",vlan_id=110, link_speed_gbps=10),
            NetworkInterface(device_id=dev11.id, name="bond0", mac_address="00:11:22:33:44:21", ip_address="172.16.2.10",vlan_id=120, link_speed_gbps=25),
            NetworkInterface(device_id=dev12.id, name="eth0",  mac_address="00:11:22:33:44:23", ip_address="192.168.1.10",vlan_id=None,link_speed_gbps=1),
            NetworkInterface(device_id=dev13.id, name="eth0",  mac_address="00:11:22:33:44:25", ip_address="192.168.1.11",vlan_id=None,link_speed_gbps=1),
            NetworkInterface(device_id=dev17.id, name="mgmt0", mac_address="00:11:22:33:44:27", ip_address="10.0.0.5",  vlan_id=1,   link_speed_gbps=1),
            NetworkInterface(device_id=dev19.id, name="eth0",  mac_address="00:11:22:33:44:29", ip_address="192.168.2.10",vlan_id=None,link_speed_gbps=1),
            NetworkInterface(device_id=dev20.id, name="eth0",  mac_address="00:11:22:33:44:31", ip_address="10.0.6.10", vlan_id=60,  link_speed_gbps=1),
            NetworkInterface(device_id=dev15.id, name="eth0",  mac_address="00:11:22:33:44:90", ip_address="10.0.3.20", vlan_id=30,  link_speed_gbps=10),
            NetworkInterface(device_id=dev14.id, name="vmnic0",mac_address="00:11:22:33:44:35", ip_address="10.0.4.11", vlan_id=40,  link_speed_gbps=25),
        ]
        db.add_all(nics)
        db.flush()

        # ── Subnets ───────────────────────────────────────────────────────────
        print("Seeding Subnets...")
        subnets = [
            Subnet(network_cidr="10.0.0.0/24",   name="HQ-MGMT",    vlan_id=1,   gateway="10.0.0.254",   dns_servers="10.0.0.53,10.0.0.54",  description="Management VLAN"),
            Subnet(network_cidr="10.0.1.0/24",   name="HQ-WEB",     vlan_id=10,  gateway="10.0.1.254",   dns_servers="10.0.0.53",             description="Web tier VLAN"),
            Subnet(network_cidr="10.0.2.0/24",   name="HQ-DB",      vlan_id=20,  gateway="10.0.2.254",   dns_servers="10.0.0.53",             description="Database tier VLAN"),
            Subnet(network_cidr="10.0.3.0/24",   name="HQ-STORAGE", vlan_id=30,  gateway="10.0.3.254",   dns_servers="10.0.0.53",             description="Storage network"),
            Subnet(network_cidr="172.16.0.0/16", name="DR-SITE",    vlan_id=100, gateway="172.16.0.254", dns_servers="172.16.0.53",           description="DR site network"),
        ]
        db.add_all(subnets)
        db.flush()

        # ── PortConnections ───────────────────────────────────────────────────
        print("Seeding PortConnections...")
        conns = [
            PortConnection(source_device_id=dev1.id,  source_port="eth0",   source_ip="10.0.1.10", source_mac="00:11:22:33:44:01", source_vlan=10,
                           target_device_id=dev5.id,  target_port="Eth1/1",  target_ip="10.0.1.1", target_mac="00:11:22:33:AA:01", target_vlan=10,
                           purpose="Primary Web Uplink", speed_gbps=10,  unit="Gbps", direction="bidirectional", cable_type="SFP+ DAC", link_type="Data"),
            PortConnection(source_device_id=dev2.id,  source_port="eth0",   source_ip="10.0.1.11", source_mac="00:11:22:33:44:03", source_vlan=10,
                           target_device_id=dev5.id,  target_port="Eth1/2",  target_ip="10.0.1.1", target_mac="00:11:22:33:AA:02", target_vlan=10,
                           purpose="Secondary Web Uplink", speed_gbps=10,  unit="Gbps", direction="bidirectional", cable_type="SFP+ DAC", link_type="Data"),
            PortConnection(source_device_id=dev3.id,  source_port="bond0",  source_ip="10.0.2.10", source_mac="00:11:22:33:44:05", source_vlan=20,
                           target_device_id=dev5.id,  target_port="Eth1/3",  target_ip="10.0.2.1", target_mac="00:11:22:33:AA:03", target_vlan=20,
                           purpose="DB Cluster Interconnect", speed_gbps=25,  unit="Gbps", direction="bidirectional", cable_type="SFP28 DAC", link_type="Data"),
            PortConnection(source_device_id=dev4.id,  source_port="bond0",  source_ip="10.0.2.11", source_mac="00:11:22:33:44:07", source_vlan=20,
                           target_device_id=dev5.id,  target_port="Eth1/4",  target_ip="10.0.2.1", target_mac="00:11:22:33:AA:04", target_vlan=20,
                           purpose="DB Cluster Interconnect", speed_gbps=25,  unit="Gbps", direction="bidirectional", cable_type="SFP28 DAC", link_type="Data"),
            PortConnection(source_device_id=dev5.id,  source_port="Eth1/48",source_ip="10.0.0.1",  source_mac="00:11:22:33:AA:FF", source_vlan=1,
                           target_device_id=dev6.id,  target_port="eth1/1",  target_ip="10.0.0.254",target_mac="00:11:22:33:44:11", target_vlan=1,
                           purpose="Firewall Management Link", speed_gbps=40,  unit="Gbps", direction="bidirectional", cable_type="QSFP+ DAC", link_type="Management"),
            PortConnection(source_device_id=dev7.id,  source_port="e0a",    source_ip="10.0.3.10", source_mac="00:11:22:33:44:13", source_vlan=30,
                           target_device_id=dev5.id,  target_port="Eth1/5",  target_ip="10.0.3.1",  target_mac="00:11:22:33:AA:05", target_vlan=30,
                           purpose="Storage NFS Export", speed_gbps=25,  unit="Gbps", direction="bidirectional", cable_type="SFP28 MMF", link_type="Storage/iSCSI"),
        ]
        db.add_all(conns)
        db.flush()

        # ── DeviceRelationships ───────────────────────────────────────────────
        print("Seeding DeviceRelationships...")
        rels = [
            DeviceRelationship(source_device_id=dev3.id,  target_device_id=dev4.id,  relationship_type="Cluster", source_role="Primary", target_role="Replica", notes="PostgreSQL streaming replication"),
            DeviceRelationship(source_device_id=dev8.id,  target_device_id=dev14.id, relationship_type="Cluster", source_role="Node",    target_role="Node",    notes="vSAN cluster hq-vsan-01"),
            DeviceRelationship(source_device_id=dev1.id,  target_device_id=dev2.id,  relationship_type="HA Pair", source_role="Active",  target_role="Standby", notes="Web server hot standby"),
            DeviceRelationship(source_device_id=dev1.id,  target_device_id=dev3.id,  relationship_type="Depends On", source_role="App", target_role="DB",       notes="Web to DB dependency"),
            DeviceRelationship(source_device_id=dev2.id,  target_device_id=dev3.id,  relationship_type="Depends On", source_role="App", target_role="DB",       notes="Web to DB dependency"),
            DeviceRelationship(source_device_id=dev3.id,  target_device_id=dev7.id,  relationship_type="Depends On", source_role="DB",  target_role="Storage",  notes="DB data on NetApp"),
            DeviceRelationship(source_device_id=dev1.id,  target_device_id=dev10.id, relationship_type="DR Pair",  source_role="Primary", target_role="DR",     notes="Cross-site DR"),
            DeviceRelationship(source_device_id=dev3.id,  target_device_id=dev11.id, relationship_type="DR Pair",  source_role="Primary", target_role="DR",     notes="Cross-site DB DR"),
            DeviceRelationship(source_device_id=dev9.id,  target_device_id=dev1.id,  relationship_type="Manages",  source_role="LB",    target_role="Backend",  notes="LB -> web pool"),
            DeviceRelationship(source_device_id=dev9.id,  target_device_id=dev2.id,  relationship_type="Manages",  source_role="LB",    target_role="Backend",  notes="LB -> web pool"),
            DeviceRelationship(source_device_id=dev22.id, target_device_id=dev5.id,  relationship_type="VPC Peer", source_role="Secondary", target_role="Primary", notes="Cisco VPC core pair"),
        ]
        db.add_all(rels)
        db.flush()

        # ── LogicalServices ───────────────────────────────────────────────────
        print("Seeding LogicalServices...")
        svc1 = LogicalService(
            device_id=dev3.id, name="PostgreSQL-PROD", service_type="Database", status="Active",
            version="15.4", environment="Production",
            config_json={"port": 5432, "max_connections": 500, "shared_buffers": "8GB"},
            purchase_type="Subscription", purchase_date=datetime(2023, 7, 1),
            expiry_date=datetime(2026, 7, 1), cost=0.0, currency="USD", vendor="PostgreSQL Global Group",
            custom_attributes={"sla": "99.99%", "rpo_minutes": 5},
        )
        svc2 = LogicalService(
            device_id=dev1.id, name="Nginx-WebFront", service_type="Web Server", status="Active",
            version="1.25.3", environment="Production",
            config_json={"port": 443, "workers": 8, "ssl": True},
            purchase_type="Open Source", purchase_date=None,
            expiry_date=None, cost=0.0, currency="USD", vendor="nginx.org",
            custom_attributes={"config_file": "/etc/nginx/nginx.conf"},
        )
        svc3 = LogicalService(
            device_id=dev8.id, name="vSphere-Cluster", service_type="Container", status="Active",
            version="8.0U2", environment="Production",
            config_json={"vcenter": "vcenter.internal", "datacenter": "HQ-DC", "cluster": "hq-vsan-01"},
            purchase_type="Perpetual", purchase_date=datetime(2024, 3, 1),
            expiry_date=datetime(2027, 3, 1), cost=48000.0, currency="USD", vendor="VMware (Broadcom)",
            custom_attributes={"license_key": "XXXXX-XXXXX-XXXXX-XXXXX"},
        )
        svc4 = LogicalService(
            device_id=dev6.id, name="PAN-OS-FW", service_type="Middleware", status="Active",
            version="11.0.2", environment="Production",
            config_json={"management_ip": "10.0.0.253", "ha_mode": "active-passive"},
            purchase_type="Subscription", purchase_date=datetime(2023, 5, 1),
            expiry_date=datetime(2026, 5, 1), cost=18000.0, currency="USD", vendor="Palo Alto Networks",
            custom_attributes={"threat_prevention": True, "url_filtering": True},
        )
        svc5 = LogicalService(
            device_id=dev9.id, name="BIG-IP-LTM", service_type="Web Server", status="Active",
            version="17.1.0", environment="Production",
            config_json={"virtual_servers": 12, "pool_members": 4},
            purchase_type="Subscription", purchase_date=datetime(2023, 8, 1),
            expiry_date=datetime(2026, 8, 1), cost=22000.0, currency="USD", vendor="F5 Networks",
            custom_attributes={"ssl_profiles": 6},
        )
        svc6 = LogicalService(
            device_id=dev20.id, name="Prometheus-Stack", service_type="Cache", status="Active",
            version="2.50.1", environment="Production",
            config_json={"retention_days": 30, "scrape_interval": "15s"},
            purchase_type="Open Source", purchase_date=None,
            expiry_date=None, cost=0.0, currency="USD", vendor="CNCF",
            custom_attributes={"targets": 45},
        )
        svc7 = LogicalService(
            device_id=dev13.id, name="K8s-Lab-Cluster", service_type="Container", status="Active",
            version="1.29.2", environment="Dev",
            config_json={"nodes": 1, "namespace": "lab", "cni": "Flannel"},
            purchase_type="Open Source", purchase_date=None,
            expiry_date=None, cost=0.0, currency="USD", vendor="CNCF",
            custom_attributes={"purpose": "dev testing"},
        )
        svc8 = LogicalService(
            device_id=dev18.id, name="Oracle-HCM", service_type="Middleware", status="Active",
            version="23D", environment="Production",
            config_json={"tenant": "hq-prod", "integration_bus": "MuleSoft"},
            purchase_type="Subscription", purchase_date=datetime(2023, 1, 1),
            expiry_date=datetime(2026, 1, 1), cost=95000.0, currency="USD", vendor="Oracle",
            custom_attributes={"users": 850, "sla": "99.9%"},
        )
        svc9 = LogicalService(
            device_id=dev12.id, name="GitLab-CI", service_type="Message Queue", status="Active",
            version="16.9.0", environment="Dev",
            config_json={"runners": 4, "concurrent_jobs": 8},
            purchase_type="Open Source", purchase_date=None,
            expiry_date=None, cost=0.0, currency="USD", vendor="GitLab",
            custom_attributes={"pipeline_count_monthly": 320},
        )
        svc10 = LogicalService(
            device_id=dev15.id, name="DDVE-Backup", service_type="Database", status="Active",
            version="7.9.0.30", environment="Production",
            config_json={"protocol": "DDBoost", "capacity_tb": 96},
            purchase_type="Perpetual", purchase_date=datetime(2023, 10, 1),
            expiry_date=datetime(2028, 10, 1), cost=35000.0, currency="USD", vendor="Dell Technologies",
            custom_attributes={"dedup_ratio": "5:1", "replication_target": "DR"},
        )
        services = [svc1, svc2, svc3, svc4, svc5, svc6, svc7, svc8, svc9, svc10]
        db.add_all(services)
        db.flush()

        # ── ServiceSecrets ────────────────────────────────────────────────────
        print("Seeding ServiceSecrets...")
        svc_secrets = [
            ServiceSecret(service_id=svc1.id, username="app_user",    password="Pg$ecure#2024!", note="App service account"),
            ServiceSecret(service_id=svc1.id, username="repl_user",   password="R3pl!cati0n#HQ",  note="Replication user"),
            ServiceSecret(service_id=svc3.id, username="administrator",password="vSph3r3@HQ2024", note="vCenter admin"),
            ServiceSecret(service_id=svc4.id, username="admin",       password="PaN0S!Admin#23",  note="PAN-OS management"),
            ServiceSecret(service_id=svc5.id, username="admin",       password="BigIP#Admin!24",  note="BIG-IP admin"),
            ServiceSecret(service_id=svc8.id, username="hcm_integr",  password="0r@cle!HCM#Prod", note="HCM integration account"),
            ServiceSecret(service_id=svc9.id, username="gitlab_root", password="G!tl@b#Root2024", note="GitLab root (lab only)"),
            ServiceSecret(service_id=svc10.id,username="ddboost",     password="DDv3!B00st#Bkp",  note="DDBoost user for Veeam"),
            ServiceSecret(service_id=svc2.id, username="nginx_mgmt",  password="Ngin$Mgmt#HQ",    note="Nginx stub_status"),
            ServiceSecret(service_id=svc6.id, username="prom_admin",  password="Pr0m#Stack!2024", note="Prometheus admin"),
        ]
        db.add_all(svc_secrets)
        db.flush()

        # ── SecretVaults ──────────────────────────────────────────────────────
        print("Seeding SecretVaults...")
        vaults = [
            SecretVault(device_id=dev1.id,  secret_type="SSH Key",   username="root",        encrypted_payload="LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K", notes="Root SSH key - rotate Q2"),
            SecretVault(device_id=dev3.id,  secret_type="SSH Key",   username="root",        encrypted_payload="LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K", notes="DB root SSH"),
            SecretVault(device_id=dev3.id,  secret_type="Password",  username="postgres",    encrypted_payload="cGdfcGFzc3dvcmRfMjAyNA==",                         notes="Postgres superuser"),
            SecretVault(device_id=dev5.id,  secret_type="Password",  username="admin",       encrypted_payload="bmV4dXNfYWRtaW5fcGFzcw==",                        notes="Nexus admin"),
            SecretVault(device_id=dev6.id,  secret_type="API Key",   username="api_user",    encrypted_payload="cGFub3NfYXBpX2tleV9wcm9k",                        notes="PAN-OS API key"),
            SecretVault(device_id=dev7.id,  secret_type="Password",  username="admin",       encrypted_payload="bmV0YXBwX2FkbWluX3Bhc3M=",                        notes="NetApp cluster admin"),
            SecretVault(device_id=dev8.id,  secret_type="Password",  username="root",        encrypted_payload="ZXN4aV9yb290X3Bhc3M=",                            notes="ESXi root password"),
            SecretVault(device_id=dev9.id,  secret_type="Password",  username="admin",       encrypted_payload="YmlnaXBfYWRtaW5fcGFzcw==",                        notes="BIG-IP admin"),
            SecretVault(device_id=dev12.id, secret_type="SSH Key",   username="ubuntu",      encrypted_payload="LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K", notes="Lab server key"),
            SecretVault(device_id=dev15.id, secret_type="Password",  username="sysadmin",    encrypted_payload="ZGRvc19zeXNhZG1pbl9wYXNz",                        notes="DD OS sysadmin"),
        ]
        db.add_all(vaults)
        db.flush()

        # ── MaintenanceWindows ────────────────────────────────────────────────
        print("Seeding MaintenanceWindows...")
        maint = [
            MaintenanceWindow(device_id=dev14.id, title="ESXi Upgrade to 8.0U2", start_time=datetime(2026, 4, 5, 2, 0), end_time=datetime(2026, 4, 5, 6, 0),  ticket_number="CHG-2026-0401", coordinator="vmware-team", status="Scheduled"),
            MaintenanceWindow(device_id=dev3.id,  title="PostgreSQL Minor Version Patch", start_time=datetime(2026, 4, 12, 1, 0), end_time=datetime(2026, 4, 12, 3, 0), ticket_number="CHG-2026-0412", coordinator="dba-team", status="Scheduled"),
            MaintenanceWindow(device_id=dev5.id,  title="NX-OS Upgrade 9.3.10 -> 9.3.11", start_time=datetime(2026, 3, 15, 0, 0), end_time=datetime(2026, 3, 15, 4, 0), ticket_number="CHG-2026-0315", coordinator="netops", status="Completed"),
            MaintenanceWindow(device_id=dev7.id,  title="ONTAP Quarterly Patch", start_time=datetime(2026, 3, 22, 2, 0), end_time=datetime(2026, 3, 22, 5, 0), ticket_number="CHG-2026-0322", coordinator="storage-team", status="Completed"),
            MaintenanceWindow(device_id=dev6.id,  title="PAN-OS Hotfix Apply", start_time=datetime(2026, 4, 20, 3, 0), end_time=datetime(2026, 4, 20, 5, 0), ticket_number="CHG-2026-0420", coordinator="security-team", status="Scheduled"),
            MaintenanceWindow(device_id=dev9.id,  title="BIG-IP SSL Cert Renewal", start_time=datetime(2026, 5, 1, 1, 0), end_time=datetime(2026, 5, 1, 2, 0), ticket_number="CHG-2026-0501", coordinator="netops", status="Scheduled"),
            MaintenanceWindow(device_id=dev1.id,  title="Disk Replacement - SSD Wear", start_time=datetime(2026, 2, 10, 4, 0), end_time=datetime(2026, 2, 10, 6, 0), ticket_number="CHG-2026-0210", coordinator="ops-team", status="Completed"),
            MaintenanceWindow(device_id=dev15.id, title="DD Firmware Upgrade",    start_time=datetime(2026, 5, 10, 2, 0), end_time=datetime(2026, 5, 10, 5, 0), ticket_number="CHG-2026-0510", coordinator="backup-team", status="Scheduled"),
        ]
        db.add_all(maint)
        db.flush()

        # ── MonitoringItems ───────────────────────────────────────────────────
        print("Seeding MonitoringItems...")
        monitors = [
            MonitoringItem(device_id=dev1.id, category="Availability", status="OK",      title="Web-01 HTTP Health",   spec="GET /health -> 200 within 2s",          platform="Prometheus", external_link="https://grafana.internal/d/web-health", purpose="Detect web server outage",      notification_method="PagerDuty", logic="probe_success == 0 for 2m", owner="ops-team", monitored_services=[svc2.id]),
            MonitoringItem(device_id=dev3.id, category="Performance",  status="Warning", title="DB-01 Query Latency",  spec="p95 SELECT latency < 50ms",              platform="Prometheus", external_link="https://grafana.internal/d/db-perf",   purpose="Catch slow queries early",      notification_method="Slack",     logic="pg_stat_activity_wait > 50ms for 5m", owner="dba-team", monitored_services=[svc1.id]),
            MonitoringItem(device_id=dev5.id, category="Capacity",     status="OK",      title="Core Switch Port Util",spec="All uplinks < 80% utilization",          platform="SNMP/Prometheus", external_link=None,                           purpose="Prevent port saturation",       notification_method="Email",     logic="ifHCInOctets rate > 0.8 * speed", owner="netops"),
            MonitoringItem(device_id=dev7.id, category="Capacity",     status="Critical",title="Storage Capacity Alert",spec="Usable capacity > 85% triggers alert", platform="ONTAP API",  external_link="https://grafana.internal/d/storage",   purpose="Prevent capacity exhaustion",   notification_method="PagerDuty", logic="df_capacity_used_pct > 85", owner="storage-team"),
            MonitoringItem(device_id=dev6.id, category="Security",     status="OK",      title="FW Threat Log Monitor",spec="Any critical threat event",              platform="Panorama",   external_link=None,                                   purpose="Real-time threat detection",    notification_method="PagerDuty", logic="threat_severity in [critical,high] count > 0 per 5m", owner="security-team", monitored_services=[svc4.id]),
            MonitoringItem(device_id=dev9.id, category="Availability", status="OK",      title="LB Pool Member Health",spec="Pool degraded if < 2 members up",        platform="iControl",   external_link=None,                                   purpose="Detect backend pool failures",   notification_method="PagerDuty", logic="pool_active_member_cnt < 2 for 1m", owner="netops", monitored_services=[svc5.id]),
            MonitoringItem(device_id=dev8.id, category="Performance",  status="OK",      title="VM Host CPU Ready",    spec="CPU ready < 5% per vCPU",                platform="vCenter",    external_link="https://vcenter.internal",             purpose="Detect VM over-commitment",     notification_method="Email",     logic="cpu_ready_pct > 5 for 10m", owner="vmware-team", monitored_services=[svc3.id]),
            MonitoringItem(device_id=None,    category="Availability", status="OK",      title="Cross-Site Replication Lag", spec="DB replication lag < 30s",        platform="Prometheus", external_link="https://grafana.internal/d/repl",      purpose="DR readiness",                  notification_method="Slack",     logic="pg_replication_lag_seconds > 30 for 5m", owner="dba-team"),
            MonitoringItem(device_id=dev15.id,category="Capacity",     status="OK",      title="Backup Job Success Rate",spec="Daily backup success >= 95%",          platform="Veeam",      external_link=None,                                   purpose="Ensure backup coverage",         notification_method="Email",     logic="backup_success_rate < 0.95", owner="backup-team", monitored_services=[svc10.id]),
            MonitoringItem(device_id=dev20.id,category="Availability", status="OK",      title="Prometheus Target Scrape",spec="All scrape targets up",               platform="Prometheus", external_link="https://grafana.internal/d/prometheus", purpose="Monitoring health self-check", notification_method="Email",     logic="up == 0 for 3m", owner="ops-team", monitored_services=[svc6.id]),
        ]
        db.add_all(monitors)
        db.flush()

        # ── IncidentLogs ──────────────────────────────────────────────────────
        print("Seeding IncidentLogs...")
        incidents = [
            IncidentLog(
                title="DB Primary Failover - Connection Saturation",
                severity="Critical", status="Resolved",
                systems=["SAP ERP"], impacted_device_ids=[dev3.id, dev4.id],
                reporter="dba-team",
                start_time=datetime(2026, 1, 14, 3, 22),
                end_time=datetime(2026, 1, 14, 4, 45),
                initial_symptoms="Application throwing connection timeout errors; pg_stat_activity showing 495/500 connections used",
                impacts_json=[{"system": "SAP ERP", "severity": "Complete outage", "duration_min": 83}],
                impact_analysis="All SAP ERP transactions failed for 83 minutes impacting ~800 users",
                trigger_event="Runaway reporting query consuming all connection slots",
                log_evidence="FATAL: remaining connection slots reserved for replication; pg_stat_activity count=499",
                mitigation_steps="Terminated offending PID 28441; increased max_connections to 600 temporarily",
                root_cause="Unoptimized reporting query issued without connection limit; no query timeout set",
                resolution_steps="Added statement_timeout=30s for reporting role; implemented connection pooling via PgBouncer",
                lessons_learned="Reporting workloads must use read replica and connection pooler",
                prevention_strategy="Enforce separate DB role for reporting; add PgBouncer in front of primary; alert at 80% connection usage",
                timeline_json=[
                    {"time": "03:22", "event": "Alerts fired: connection usage > 95%"},
                    {"time": "03:31", "event": "On-call engaged"},
                    {"time": "03:45", "event": "Offending query identified"},
                    {"time": "03:48", "event": "Query terminated; connections released"},
                    {"time": "04:45", "event": "Root cause confirmed; permanent fix deployed"},
                ],
                todos_json=[
                    {"task": "Deploy PgBouncer", "owner": "dba-team", "due": "2026-02-01", "status": "Done"},
                    {"task": "Add connection alert at 80%", "owner": "ops-team", "due": "2026-01-20", "status": "Done"},
                ],
            ),
            IncidentLog(
                title="Core Switch Partial Packet Loss - SFP Degradation",
                severity="Major", status="Resolved",
                systems=["IT-Infra"], impacted_device_ids=[dev5.id, dev1.id, dev2.id],
                reporter="netops",
                start_time=datetime(2026, 2, 3, 11, 5),
                end_time=datetime(2026, 2, 3, 12, 30),
                initial_symptoms="Intermittent 2-5% packet loss on Eth1/1 and Eth1/2 uplinks to web servers",
                impacts_json=[{"system": "IT-Infra", "severity": "Degraded", "duration_min": 85}],
                impact_analysis="Web response times elevated 40%; some user sessions dropped",
                trigger_event="SFP+ module on Eth1/1 beginning to fail after 3 years operation",
                log_evidence="Interface errors: input errors 4821, CRC errors 1204 over 30 min window",
                mitigation_steps="Moved uplinks to spare ports Eth1/35-36; replaced SFP modules",
                root_cause="SFP+ optical module end of life; no proactive replacement schedule",
                resolution_steps="Replaced both SFP modules; added optic health monitoring to Prometheus",
                lessons_learned="SFP modules should be proactively replaced at 3-year mark",
                prevention_strategy="Add SFP DOM monitoring; schedule proactive replacement lifecycle",
                timeline_json=[
                    {"time": "11:05", "event": "Monitoring alert: packet loss > 1%"},
                    {"time": "11:20", "event": "Network engineer identified Eth1/1 errors"},
                    {"time": "11:45", "event": "Traffic migrated to spare ports"},
                    {"time": "12:30", "event": "SFP replaced; incident closed"},
                ],
                todos_json=[
                    {"task": "Add SFP DOM monitoring", "owner": "netops", "due": "2026-02-15", "status": "Done"},
                ],
            ),
            IncidentLog(
                title="Storage Capacity Warning - Prod Volume 87% Full",
                severity="Minor", status="Resolved",
                systems=["IT-Infra", "SAP ERP"], impacted_device_ids=[dev7.id],
                reporter="storage-team",
                start_time=datetime(2026, 2, 18, 9, 0),
                end_time=datetime(2026, 2, 18, 11, 30),
                initial_symptoms="ONTAP capacity alert fired at 87% on /vol/sap_data",
                impacts_json=[{"system": "SAP ERP", "severity": "Risk only", "duration_min": 0}],
                impact_analysis="No outage; capacity threshold reached sooner than projected due to EOM financial processing",
                trigger_event="Month-end batch job generated 12TB more data than forecast",
                log_evidence="NetApp EMS: Vol space used 87.3% - vol sap_data (node: hq-stor-01)",
                mitigation_steps="Moved cold data to S3-compatible tier; freed 18TB",
                root_cause="Capacity model did not account for EOM spike; 3-month rolling average used",
                resolution_steps="Tiering policy adjusted; purchased additional 50TB capacity",
                lessons_learned="EOM batch data growth should be modeled separately from steady-state",
                prevention_strategy="Automate tiering trigger at 75%; include EOM spike in capacity planning model",
                timeline_json=[
                    {"time": "09:00", "event": "Capacity alert at 85%"},
                    {"time": "09:45", "event": "Storage engineer identified cold data candidates"},
                    {"time": "11:30", "event": "Tiering complete; capacity at 68%"},
                ],
                todos_json=[
                    {"task": "Update capacity model", "owner": "storage-team", "due": "2026-03-01", "status": "Done"},
                ],
            ),
            IncidentLog(
                title="Firewall Policy Misconfiguration - Blocked Staging Traffic",
                severity="Major", status="Resolved",
                systems=["Sales-B2B"], impacted_device_ids=[dev6.id, dev19.id],
                reporter="security-team",
                start_time=datetime(2026, 3, 5, 14, 0),
                end_time=datetime(2026, 3, 5, 14, 45),
                initial_symptoms="Staging environment API calls timing out; developers unable to reach lab-stg-01",
                impacts_json=[{"system": "Sales-B2B", "severity": "Dev/Staging outage", "duration_min": 45}],
                impact_analysis="QA testing blocked for 45 minutes; sprint demo delayed",
                trigger_event="Firewall policy push included incorrect address object for staging subnet",
                log_evidence="PAN-OS traffic logs: deny from 10.0.0.0/8 to 192.168.2.0/24 on rule staging-block",
                mitigation_steps="Reverted policy to previous commit; staging access restored",
                root_cause="Address object 'staging-subnet' pointed to wrong CIDR due to copy-paste error",
                resolution_steps="Fixed address object; added peer review requirement for firewall changes",
                lessons_learned="All firewall policy changes must have second approver before push",
                prevention_strategy="Implement change management gate in Panorama; require test in pre-prod first",
                timeline_json=[
                    {"time": "14:00", "event": "Developers report staging unreachable"},
                    {"time": "14:15", "event": "FW logs show deny rule hit"},
                    {"time": "14:22", "event": "Identified incorrect address object"},
                    {"time": "14:45", "event": "Policy reverted; access restored"},
                ],
                todos_json=[
                    {"task": "Add 4-eyes approval to Panorama", "owner": "security-team", "due": "2026-03-20", "status": "In Progress"},
                ],
            ),
            IncidentLog(
                title="ESXi Host Memory Pressure - VM Swap Storm",
                severity="Major", status="Investigating",
                systems=["DevOps"], impacted_device_ids=[dev14.id],
                reporter="vmware-team",
                start_time=datetime(2026, 3, 28, 7, 30),
                end_time=None,
                initial_symptoms="hq-vm-host-02 balloon driver active on 8 VMs; disk I/O spiking on vSAN datastore",
                impacts_json=[{"system": "DevOps", "severity": "Degraded VM performance", "duration_min": 0}],
                impact_analysis="28 VMs on host experiencing degraded performance; no outages yet",
                trigger_event="3 new VMs deployed without right-sizing; host now overcommitted at 112% RAM",
                log_evidence="esxtop: MCTLSZ 14GB, SWPWRT 2.1GB/s; vCenter alarms: Memory usage > 95%",
                mitigation_steps="vMotioned 4 VMs to hq-vm-host-01; balloon pressure reduced",
                root_cause="Under investigation - VM sizing process bypass suspected",
                resolution_steps="Pending",
                lessons_learned="Pending post-incident review",
                prevention_strategy="Pending",
                timeline_json=[
                    {"time": "07:30", "event": "vCenter memory alarm triggered"},
                    {"time": "07:45", "event": "On-call vmware-team engaged"},
                    {"time": "08:10", "event": "4 VMs vMotioned; pressure reduced"},
                    {"time": "Ongoing", "event": "Root cause investigation in progress"},
                ],
                todos_json=[
                    {"task": "Right-size 3 new VMs", "owner": "vmware-team", "due": "2026-03-31", "status": "In Progress"},
                    {"task": "Enforce VM sizing checklist", "owner": "engineering", "due": "2026-04-15", "status": "Open"},
                ],
            ),
        ]
        db.add_all(incidents)
        db.flush()

        # ── ExternalEntities (Partner IQ) ─────────────────────────────────────
        print("Seeding External Entities (Partner IQ)...")
        ext1 = ExternalEntity(
            name="AWS Public Cloud (US-EAST-1)",
            type="Cloud Provider",
            hostname="aws-us-east-1.amazonaws.com",
            ip_address="3.218.0.0/16",
            owner_organization="Amazon Web Services",
            description="Global AWS North Virginia Region",
            contact_info="aws-support@example.com"
        )
        ext2 = ExternalEntity(
            name="Global Payments Gateway",
            type="FinTech API",
            hostname="api.globalpay.com",
            ip_address="52.12.33.44",
            owner_organization="GlobalPay Inc",
            description="Main payment processing endpoint",
            contact_info="noc@globalpay.com"
        )
        ext3 = ExternalEntity(
            name="Partner-Logistics-Node",
            type="External Server",
            hostname="logistics.partner-x.com",
            ip_address="192.168.50.100",
            owner_organization="Partner Logistics Ltd",
            description="B2B Logistics data exchange node",
            contact_info="tech-lead@partner-x.com"
        )
        db.add_all([ext1, ext2, ext3])
        db.flush()

        # ── ExternalLinks (Partner IQ Connectivity) ───────────────────────────
        print("Seeding External Links...")
        ext_links = [
            ExternalLink(
                external_entity_id=ext1.id,
                device_id=dev6.id, # hq-fw-01
                service_id=None,
                direction="Bidirectional",
                purpose="Direct Connect to AWS VPC",
                protocol="BGP/IPsec",
                port="443, 500, 4500",
                credentials={"tunnel_id": "T-990-AX", "psk": "SECURE_TUNNEL_KEY"}
            ),
            ExternalLink(
                external_entity_id=ext2.id,
                device_id=dev1.id, # hq-web-01
                service_id=svc2.id, # Nginx-WebFront
                direction="Upstream",
                purpose="Payment API Integration",
                protocol="HTTPS",
                port="443",
                credentials={"api_key": "GP_LIVE_KEY_8821"}
            ),
            ExternalLink(
                external_entity_id=ext3.id,
                device_id=dev3.id, # hq-db-01
                service_id=svc1.id, # PostgreSQL-PROD
                direction="Downstream",
                purpose="Daily Sales Sync",
                protocol="SFTP",
                port="22",
                credentials={"username": "sysgrid_sync", "password": "PARTNER_PASS_X"}
            )
        ]
        db.add_all(ext_links)
        db.flush()

        # ── DataFlows ─────────────────────────────────────────────────────────
        print("Seeding DataFlows...")
        flows = [
            DataFlow(
                name="CORPORATE_ERP_ECOSYSTEM",
                description="High-fidelity map of ERP traffic from Web to DB including Partner Sync",
                category="System",
                nodes_json=[
                    {"id": "node-device-1", "type": "device", "data": {"name": "hq-web-01", "type": "Physical", "environment": "Production", "status": "Active"}, "position": {"x": 400, "y": 200}},
                    {"id": "node-service-2", "type": "service", "parentNode": "node-device-1", "data": {"name": "Nginx-WebFront", "service_type": "Web Server"}, "position": {"x": 20, "y": 60}},
                    {"id": "node-device-3", "type": "device", "data": {"name": "hq-db-01", "type": "Physical", "environment": "Production", "status": "Active"}, "position": {"x": 800, "y": 200}},
                    {"id": "node-service-1", "type": "service", "parentNode": "node-device-3", "data": {"name": "PostgreSQL-PROD", "service_type": "Database"}, "position": {"x": 20, "y": 60}},
                    {"id": "node-external-2", "type": "external", "data": {"name": "Global Payments Gateway", "owner_organization": "GlobalPay Inc"}, "position": {"x": 50, "y": 200}},
                ],
                edges_json=[
                    {"id": "e1", "source": "node-external-2", "target": "node-service-2", "type": "labeled", "animated": True, "data": {"label": "PAYMENT_API", "type": "DATA"}},
                    {"id": "e2", "source": "node-service-2", "target": "node-service-1", "type": "labeled", "animated": True, "data": {"label": "SQL_QUERY", "type": "DATA"}},
                ],
                viewport_json={"x": 0, "y": 0, "zoom": 1.0},
                is_template=False,
            ),
        ]
        db.add_all(flows)
        db.flush()

        # ── FirewallRules ─────────────────────────────────────────────────────
        print("Seeding FirewallRules...")
        fw_rules = [
            FirewallRule(
                name="Allow HTTPS to Web Tier",
                risk="Loss of public website access and revenue",
                source_type="Any",
                dest_type="Subnet",
                dest_subnet_id=subnets[1].id, # HQ-WEB
                protocol="TCP",
                port_range="443",
                direction="Inbound",
                action="Allow",
                status="Active"
            ),
            FirewallRule(
                name="Web to DB Access",
                risk="Application layer database connection failure",
                source_type="Subnet",
                source_subnet_id=subnets[1].id, # HQ-WEB
                dest_type="Subnet",
                dest_subnet_id=subnets[2].id, # HQ-DB
                protocol="TCP",
                port_range="5432",
                direction="Inbound",
                action="Allow",
                status="Active"
            ),
            FirewallRule(
                name="Management SSH Access",
                risk="Total loss of administrative control over infrastructure",
                source_type="Device",
                source_device_id=dev24.id, # hq-jump-01
                dest_type="Any",
                protocol="TCP",
                port_range="22",
                direction="Inbound",
                action="Allow",
                status="Active"
            ),
            FirewallRule(
                name="Block Malicious External IP",
                risk="Potential security breach from known threat actor",
                source_type="Custom IP",
                source_custom_ip="185.123.45.67",
                dest_type="Any",
                protocol="Any",
                direction="Inbound",
                action="Deny",
                status="Active"
            ),
            FirewallRule(
                name="Backup Replication to DR",
                risk="Violation of DR policy and data loss during site failure",
                source_type="Device",
                source_device_id=dev15.id, # hq-backup-01
                dest_type="Subnet",
                dest_subnet_id=subnets[4].id, # DR-SITE
                protocol="TCP",
                port_range="10000-11000",
                direction="Outbound",
                action="Allow",
                status="Active"
            ),
            FirewallRule(
                name="External Monitoring to DB",
                risk="Loss of visibility into database performance metrics",
                source_type="Custom IP",
                source_custom_ip="203.0.113.42",
                dest_type="Device",
                dest_device_id=dev3.id, # hq-db-01
                protocol="TCP",
                port_range="9100",
                direction="Inbound",
                action="Allow",
                status="Active"
            ),
            FirewallRule(
                name="Any to NTP Subnet",
                risk="System clock drift causing authentication failures",
                source_type="Any",
                dest_type="Subnet",
                dest_subnet_id=subnets[0].id, # HQ-MGMT
                protocol="UDP",
                port_range="123",
                direction="Inbound",
                action="Allow",
                status="Active"
            ),
            FirewallRule(
                name="Device to Custom IP",
                risk="Failure of external API dependency integrations",
                source_type="Device",
                source_device_id=dev1.id,
                dest_type="Custom IP",
                dest_custom_ip="1.1.1.1",
                protocol="TCP",
                port_range="443",
                direction="Outbound",
                action="Allow",
                status="Active"
            )
        ]
        db.add_all(fw_rules)
        db.flush()

        # ── AuditLogs ─────────────────────────────────────────────────────────
        print("Seeding AuditLogs...")
        audits = [
            AuditLog(user_id="alice.kim",   action="CREATE", target_table="devices",         target_id=str(dev1.id),  description=f"Created device {dev1.name}",          changes={"name": dev1.name, "type": dev1.type}),
            AuditLog(user_id="alice.kim",   action="CREATE", target_table="devices",         target_id=str(dev3.id),  description=f"Created device {dev3.name}",          changes={"name": dev3.name, "type": dev3.type}),
            AuditLog(user_id="bob.park",    action="UPDATE", target_table="devices",         target_id=str(dev14.id), description="Updated status to Maintenance",        changes={"status": {"old": "Active", "new": "Maintenance"}}),
            AuditLog(user_id="carol.chen",  action="CREATE", target_table="racks",           target_id=str(rack_lab1.id), description=f"Created rack {rack_lab1.name}",   changes={"name": rack_lab1.name, "room_id": rack_lab1.room_id}),
            AuditLog(user_id="alice.kim",   action="CREATE", target_table="device_locations",target_id=str(dev1.id),  description=f"Mounted {dev1.name} in {rack_hq1.name} U40", changes={"start_unit": 40, "size_u": 2}),
            AuditLog(user_id="bob.park",    action="CREATE", target_table="logical_services", target_id=str(svc1.id), description=f"Created service {svc1.name}",         changes={"name": svc1.name, "service_type": svc1.service_type}),
            AuditLog(user_id="security-team", action="CREATE", target_table="secret_vault",  target_id=str(dev6.id),  description="Added API key for PAN-OS",             changes={"secret_type": "API Key"}),
            AuditLog(user_id="netops",      action="CREATE", target_table="port_connections", target_id=str(dev1.id), description="Cabled hq-web-01 eth0 to core switch", changes={"port": "eth0", "target": "hq-sw-core-01:Eth1/1"}),
            AuditLog(user_id="dba-team",    action="UPDATE", target_table="logical_services", target_id=str(svc1.id), description="Updated PostgreSQL max_connections",   changes={"config_json": {"max_connections": {"old": 400, "new": 500}}}),
            AuditLog(user_id="alice.kim",   action="DELETE", target_table="devices",         target_id="999",         description="Decommissioned old test VM",            changes={"name": "old-test-vm-01", "is_deleted": True}),
        ]
        db.add_all(audits)
        db.flush()

        db.commit()
        print("Seed complete.")
        print(f"  Sites: 3 | Rooms: 6 | Racks: 9 | Devices: 29")
        print(f"  ExternalEntities: 3 | ExternalLinks: 3")
        print(f"  DeviceLocations: 23 | HardwareComponents: 15 | DeviceSoftware: 15")
        print(f"  NetworkInterfaces: 20 | Subnets: 5 | PortConnections: 19")
        print(f"  DeviceRelationships: 11 | LogicalServices: 10 | ServiceSecrets: 10")
        print(f"  SecretVaults: 10 | MaintenanceWindows: 8 | MonitoringItems: 10")
        print(f"  IncidentLogs: 5 | DataFlows: 1 | AuditLogs: 10 | SettingOptions: 36")


if __name__ == "__main__":
    seed()
