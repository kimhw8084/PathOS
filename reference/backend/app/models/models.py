from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

class BaseMixin:
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    created_by_user_id = Column(String, default="system_admin")

class Site(Base, BaseMixin):
    __tablename__ = "sites"
    name = Column(String, index=True, unique=True)
    address = Column(String)
    facility_manager = Column(String)
    contact_phone = Column(String)
    cooling_capacity_kw = Column(Float, default=0.0)
    power_capacity_kw = Column(Float, default=0.0)
    order_index = Column(Integer, default=0)
    rooms = relationship("Room", back_populates="site", cascade="all, delete-orphan")

class Room(Base, BaseMixin):
    __tablename__ = "rooms"
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"))
    name = Column(String)
    floor_level = Column(String)
    hvac_zone = Column(String)
    fire_suppression_type = Column(String)
    site = relationship("Site", back_populates="rooms")
    racks = relationship("Rack", back_populates="room")

class Rack(Base, BaseMixin):
    __tablename__ = "racks"
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, index=True)
    total_u_height = Column(Integer, default=42)
    max_power_kw = Column(Float, default=8.0)
    typical_power_kw = Column(Float, default=4.0)
    max_weight_kg = Column(Float, default=1000.0)
    cooling_type = Column(String)
    pdu_a_id = Column(String)
    pdu_b_id = Column(String)
    is_deleted = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    last_site_name = Column(String, nullable=True) # Historical record for unassigned racks
    room = relationship("Room", back_populates="racks")
    device_locations = relationship("DeviceLocation", back_populates="rack", cascade="all, delete-orphan")

class Device(Base, BaseMixin):
    __tablename__ = "devices"
    name = Column(String, index=True) # Hostname (Removed unique)
    system = Column(String, index=True) # Logical System name
    environment = Column(String, default="Production")
    status = Column(String, default="Active")
    type = Column(String) # Physical, Virtual, Storage, Switch
    size_u = Column(Integer, default=1) # Default U-height for the device
    
    manufacturer = Column(String)
    model = Column(String)
    serial_number = Column(String, index=True) # Removed unique
    asset_tag = Column(String, index=True)
    part_number = Column(String)
    
    os_name = Column(String)
    os_version = Column(String)
    management_ip = Column(String)
    primary_ip = Column(String)
    management_url = Column(String)
    
    owner = Column(String)
    business_unit = Column(String)
    vendor = Column(String)
    purchase_order = Column(String)
    cost_center = Column(String)
    purchase_date = Column(DateTime, nullable=True)
    install_date = Column(DateTime, nullable=True)
    warranty_end = Column(DateTime, nullable=True)
    eol_date = Column(DateTime, nullable=True)
    role = Column(String) # Role description of the asset
    
    power_supply_count = Column(Integer, default=2)
    power_max_w = Column(Float, default=0.0)
    power_typical_w = Column(Float, default=0.0)
    btu_hr = Column(Float, default=0.0)
    depth = Column(String, default="Full") # Full, Half
    
    tool_group = Column(String)
    fab_area = Column(String)
    recipe_critical = Column(Boolean, default=False)
    
    metadata_json = Column(JSON, default=dict)
    is_reservation = Column(Boolean, default=False)
    reservation_info = Column(JSON, default=dict) # {est_arrival: "YYYY-MM", requester: "Name"}
    is_deleted = Column(Boolean, default=False)
    
    locations = relationship("DeviceLocation", back_populates="device", cascade="all, delete-orphan")
    components = relationship("HardwareComponent", back_populates="device", cascade="all, delete-orphan")
    software = relationship("DeviceSoftware", back_populates="device", cascade="all, delete-orphan")
    secrets = relationship("SecretVault", back_populates="device", cascade="all, delete-orphan")
    relationships = relationship("DeviceRelationship", primaryjoin="Device.id==DeviceRelationship.source_device_id", cascade="all, delete-orphan")
    maintenance_windows = relationship("MaintenanceWindow", back_populates="device", cascade="all, delete-orphan")
    logical_services = relationship("LogicalService", back_populates="device")
    monitoring_items = relationship("MonitoringItem", back_populates="device", cascade="all, delete-orphan")
    network_interfaces = relationship("NetworkInterface", back_populates="device", cascade="all, delete-orphan")

class LogicalService(Base, BaseMixin):
    __tablename__ = "logical_services"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True) # Nullable if service is floating/clustered
    name = Column(String, index=True) # Service Name
    service_type = Column(String, index=True) # Database, Web, Middleware, Container, ToolStack, Other
    status = Column(String, default="Active") # Active, Stopped, Critical, Maintenance
    version = Column(String)
    environment = Column(String, default="Production")
    purpose = Column(Text) # Purpose description
    documentation_link = Column(String) # Link to source, installation, app, etc.
    installation_date = Column(DateTime) # Date of installation or planned installation
    
    # Exaustive Predefined Schemas stored in JSON for maximum flexibility + strict UI enforcement
    # For Database: { engine, instance_name, port, sid, collation, always_on, data_path, backup_policy }
    # For Web: { server_type, url, bindings, app_pool, ssl_expiry, root_path }
    config_json = Column(JSON, default=dict)
    
    # License & Procurement
    purchase_type = Column(String) # One-time, Subscription
    purchase_date = Column(DateTime)
    expiry_date = Column(DateTime)
    cost = Column(Float, default=0.0)
    currency = Column(String, default="USD") # USD, KRW
    vendor = Column(String)
    
    # Smart Expandability: Unlimited custom key-values
    custom_attributes = Column(JSON, default=dict)
    is_deleted = Column(Boolean, default=False)
    
    device = relationship("Device", back_populates="logical_services")
    secrets = relationship("ServiceSecret", back_populates="service", cascade="all, delete-orphan")

class ServiceSecret(Base, BaseMixin):
    __tablename__ = "service_secrets"
    service_id = Column(Integer, ForeignKey("logical_services.id", ondelete="CASCADE"))
    username = Column(String)
    password = Column(String)
    note = Column(Text)
    service = relationship("LogicalService", back_populates="secrets")

class DeviceRelationship(Base, BaseMixin):
    __tablename__ = "device_relationships"
    source_device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    target_device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    relationship_type = Column(String)
    source_role = Column(String)
    target_role = Column(String)
    notes = Column(Text)

class DeviceLocation(Base, BaseMixin):
    __tablename__ = "device_locations"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    rack_id = Column(Integer, ForeignKey("racks.id", ondelete="CASCADE"))
    start_unit = Column(Integer)
    size_u = Column(Integer)
    orientation = Column(String, default="Front") # Front, Back
    depth = Column(String, default="Full") # Full, Half
    device = relationship("Device", back_populates="locations")
    rack = relationship("Rack", back_populates="device_locations")

class HardwareComponent(Base, BaseMixin):
    __tablename__ = "hardware_components"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    category = Column(String) # CPU, Memory, Card, SSD, HDD, NIC
    name = Column(String)
    manufacturer = Column(String)
    specs = Column(String)
    count = Column(Integer, default=1)
    serial_number = Column(String)
    device = relationship("Device", back_populates="components")

class DeviceSoftware(Base, BaseMixin):
    __tablename__ = "device_software"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    category = Column(String)
    name = Column(String)
    version = Column(String)
    install_date = Column(DateTime)
    purpose = Column(String)
    notes = Column(Text)
    device = relationship("Device", back_populates="software")

class NetworkInterface(Base, BaseMixin):
    __tablename__ = "network_interfaces"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    name = Column(String)
    mac_address = Column(String, unique=True, index=True)
    ip_address = Column(String, index=True)
    vlan_id = Column(Integer, nullable=True)
    link_speed_gbps = Column(Integer)
    device = relationship("Device", back_populates="network_interfaces")

class PortConnection(Base, BaseMixin):
    __tablename__ = "port_connections"
    source_device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    source_port = Column(String)
    source_ip = Column(String, nullable=True)
    source_mac = Column(String, nullable=True)
    source_vlan = Column(Integer, nullable=True)
    target_device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    target_port = Column(String)
    target_ip = Column(String, nullable=True)
    target_mac = Column(String, nullable=True)
    target_vlan = Column(Integer, nullable=True)
    link_type = Column(String)  # Renamed from purpose
    purpose = Column(Text)     # New description field
    speed_gbps = Column(Float)
    unit = Column(String)
    direction = Column(String)
    cable_type = Column(String)

class Subnet(Base, BaseMixin):
    __tablename__ = "subnets"
    network_cidr = Column(String, index=True, unique=True)
    name = Column(String)
    vlan_id = Column(Integer, nullable=True)
    gateway = Column(String, nullable=True)
    dns_servers = Column(String, nullable=True) # Comma separated
    description = Column(Text)

class SettingOption(Base, BaseMixin):
    __tablename__ = "settings_options"
    category = Column(String, index=True) # LogicalSystem, DeviceType, ServiceType, etc.
    label = Column(String)
    value = Column(String)
    description = Column(String, nullable=True)
    metadata_keys = Column(JSON, default=list) # For ServiceType: ["port", "dbname", etc]
    is_default = Column(Boolean, default=False)

class SecretVault(Base, BaseMixin):
    __tablename__ = "secret_vault"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    secret_type = Column(String)
    username = Column(String)
    encrypted_payload = Column(Text)
    notes = Column(Text)
    device = relationship("Device", back_populates="secrets")

class MaintenanceWindow(Base, BaseMixin):
    __tablename__ = "maintenance_windows"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"))
    title = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    ticket_number = Column(String)
    coordinator = Column(String)
    status = Column(String)
    device = relationship("Device", back_populates="maintenance_windows")

class MonitoringItem(Base, BaseMixin):
    __tablename__ = "monitoring_items"
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=True)
    category = Column(String, index=True) # Hardware, Log, Network, App, Synthetic
    status = Column(String, index=True) # Existing, Planned, Cancelled
    title = Column(String) # What's being monitored
    spec = Column(Text) # Details/Thresholds
    platform = Column(String) # Zabbix, Prometheus, Datadog, etc.
    external_link = Column(String) # Direct clickable link
    purpose = Column(Text)
    notification_method = Column(String) # Email, Slack, PagerDuty
    logic = Column(Text) # For log-based: regex or query
    owner = Column(String)
    monitored_services = Column(JSON, default=list) # List of LogicalService IDs
    
    device = relationship("Device", back_populates="monitoring_items")

class FirewallRule(Base, BaseMixin):
    __tablename__ = "firewall_rules"
    name = Column(String, index=True)
    risk = Column(Text) # Business impact if rule is missing
    
    # Source Configuration
    source_type = Column(String) # Device, Subnet, Custom IP, Any
    source_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    source_subnet_id = Column(Integer, ForeignKey("subnets.id", ondelete="SET NULL"), nullable=True)
    source_custom_ip = Column(String) # For external or one-off IPs
    
    # Destination Configuration
    dest_type = Column(String) # Device, Subnet, Custom IP, Any
    dest_device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    dest_subnet_id = Column(Integer, ForeignKey("subnets.id", ondelete="SET NULL"), nullable=True)
    dest_custom_ip = Column(String)
    
    # Protocol & Ports
    protocol = Column(String, default="TCP") # TCP, UDP, ICMP, Any
    port_range = Column(String) # e.g. "443", "1433,1434", "1024-2048"
    direction = Column(String, default="Inbound") # Inbound, Outbound
    action = Column(String, default="Allow") # Allow, Deny
    
    status = Column(String, default="Active") # Active, Requested, Decommissioned
    is_deleted = Column(Boolean, default=False)

    source_device = relationship("Device", foreign_keys=[source_device_id])
    dest_device = relationship("Device", foreign_keys=[dest_device_id])
    source_subnet = relationship("Subnet", foreign_keys=[source_subnet_id])
    dest_subnet = relationship("Subnet", foreign_keys=[dest_subnet_id])

class IncidentLog(Base, BaseMixin):
    __tablename__ = "incident_logs"
    systems = Column(JSON, default=list) # Multi-select systems
    impacted_device_ids = Column(JSON, default=list) # Multi-select assets

    title = Column(String, index=True)
    severity = Column(String, default="Major") # Critical, Major, Minor
    status = Column(String, default="Investigating") # Investigating, Identified, Monitoring, Resolved, Prevented
    start_time = Column(DateTime)
    end_time = Column(DateTime, nullable=True)
    reporter = Column(String)

    # Forensic / Progressive disclosure fields
    initial_symptoms = Column(Text) # "Day zero" info
    impacts_json = Column(JSON, default=list) # Multi-select categories (Wafer loss, Blockage, etc.)
    impact_analysis = Column(Text)
    # Deep Forensics (For engineers)
    trigger_event = Column(Text) # Change, load spike, etc.
    log_evidence = Column(Text) # Error log snippets
    mitigation_steps = Column(Text) # Temporary stability
    root_cause = Column(Text) # Final finding
    resolution_steps = Column(Text) # Permanent fix

    # Post-Mortem / Reliability
    lessons_learned = Column(Text)
    prevention_strategy = Column(Text)

    timeline_json = Column(JSON, default=list) # [{time, event, type}]
    todos_json = Column(JSON, default=list) # [{task, status, owner}]
class DataFlow(Base, BaseMixin):
    __tablename__ = "data_flows"
    name = Column(String, index=True)
    description = Column(Text)
    category = Column(String, default="System") # System, Service, Application
    nodes_json = Column(JSON, default=list)
    edges_json = Column(JSON, default=list)
    viewport_json = Column(JSON, default=dict)
    is_template = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)

class ExternalEntity(Base, BaseMixin):
    __tablename__ = "external_entities"
    name = Column(String, index=True)
    type = Column(String) # Server, DB, PC, Network, Cloud Service
    hostname = Column(String)
    ip_address = Column(String)
    owner_organization = Column(String)
    description = Column(Text)
    contact_info = Column(String)

class ExternalLink(Base, BaseMixin):
    __tablename__ = "external_links"
    external_entity_id = Column(Integer, ForeignKey("external_entities.id"))
    device_id = Column(Integer, ForeignKey("devices.id"))
    service_id = Column(Integer, ForeignKey("logical_services.id"), nullable=True)
    direction = Column(String) # Upstream, Downstream
    purpose = Column(String)
    protocol = Column(String) # TCP, UDP, HTTPS, etc.
    port = Column(String)
    credentials = Column(JSON) # Store as { "username": "...", "password": "...", "note": "..." }
    
    external_entity = relationship("ExternalEntity")
    device = relationship("Device")
    service = relationship("LogicalService")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, server_default=func.now())
    user_id = Column(String)
    action = Column(String)
    target_table = Column(String)
    target_id = Column(String)
    changes = Column(JSON)
    description = Column(Text)
