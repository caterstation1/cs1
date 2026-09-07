export const FCP_DASHBOARD_CATEGORIES = [
  "Today",
  "Fridges",
  "Chicken",
  "Lamb",
  "Pork",
  "Beef",
  "Cleaning",
  "Suppliers",
  "Thermometers",
  "Allergens",
  "Incidents",
  "Settings",
  "Audit",
] as const;

export const FCP_QUICK_ACTIONS = [
  {
    label: "Fridge temp",
    ruleCode: "daily_fridge_temp_check",
    category: "Fridges",
  },
  {
    label: "Chicken temp",
    ruleCode: "per_batch_fried_chicken_check",
    category: "Chicken",
  },
  {
    label: "Beef weekly batch check",
    ruleCode: "weekly_batch_check",
    category: "Beef",
  },
  {
    label: "Lamb weekly batch check",
    ruleCode: "weekly_lamb_batch_check",
    category: "Lamb",
  },
  {
    label: "Pork weekly batch check",
    ruleCode: "weekly_pork_batch_check",
    category: "Pork",
  },
  {
    label: "Fried chicken weekly check",
    ruleCode: "weekly_chicken_batch_check",
    category: "Chicken",
  },
  {
    label: "Chicken liver pate check",
    ruleCode: "chicken_liver_pate_check",
    category: "Chicken",
  },
  {
    label: "Cleaning done",
    ruleCode: "daily_cleaning_tasks",
    category: "Cleaning",
  },
  {
    label: "Periodic cleaning",
    ruleCode: "periodic_cleaning_task",
    category: "Cleaning",
  },
  {
    label: "Thermometer check",
    ruleCode: "thermometer_calibration_due",
    category: "Thermometers",
  },
  {
    label: "6-month pH tester check",
    ruleCode: "six_month_ph_tester_check",
    category: "Thermometers",
  },
  {
    label: "Supplier delivery",
    ruleCode: "supplier_delivery_check",
    category: "Suppliers",
  },
  {
    label: "Something went wrong",
    ruleCode: "incident_creation",
    category: "Incidents",
  },
  {
    label: "Customer complaint",
    ruleCode: "customer_complaint",
    category: "Incidents",
  },
  {
    label: "Recall check",
    ruleCode: "recall_matching",
    category: "Audit",
  },
  {
    label: "Acid/pH check",
    ruleCode: "acid_control_check",
    category: "Today",
  },
  {
    label: "Training quiz",
    ruleCode: "staff_training_quiz",
    category: "Audit",
  },
] as const;
