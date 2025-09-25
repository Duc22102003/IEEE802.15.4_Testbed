/*
 * Add.h
 *
 *  Created on: Jun 1, 2025
 *      Author: BacTV
 */

#ifndef ADD_H_
#define ADD_H_
#include "scan.h"
#include "em_system.h"

#define POWER_DETECT 0
#define POWER_LEVEL 1
#define CURRENT_CH 2
#define THRESHOLD 3
extern void PrintEUID64();

void energy_scan_result_callback(uint8_t channel, int8_t rssi_min, int8_t rssi_max, int8_t rssi_avg) {
    PrintEUID64();
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "{EScan Ch%d : %d}\n", channel, rssi_avg);
}
void scan_complete_callback(sl_channel_mask_t unscannedChannelsMask) {
    sl_iostream_printf(SL_IOSTREAM_STDOUT, "Energy scan complete. Unscanned channels mask: 0x%08lX\r\n", unscannedChannelsMask);
}
static void cmd_energy_scan_handler(sl_cli_command_arg_t *arguments)
{
  uint8_t scan_duration = sl_cli_get_argument_uint8(arguments, 0);
  sl_channel_mask_t channel_mask = 0x07FFF800;
  sl_status_t status = sli_mac_energy_scan(channel_mask, scan_duration, energy_scan_result_callback, scan_complete_callback);
  if (status != SL_STATUS_OK) {
      sl_iostream_printf(SL_IOSTREAM_STDOUT, "Failed to start energy scan: 0x%04lX\r\n", status);
  } else {
      sl_iostream_printf(SL_IOSTREAM_STDOUT, "Energy scan started\r\n");
  }
}

static const sl_cli_command_info_t cmd_energy_scan_info = \
    SL_CLI_COMMAND(cmd_energy_scan_handler,
        "Start an energy scan",
        "Input scan duration",
        {SL_CLI_ARG_UINT8OPT, SL_CLI_ARG_END, });

static sl_cli_command_entry_t escan_command_table[] = {
    { "escan", (sl_cli_command_info_t *)&cmd_energy_scan_info, false },
    { NULL, NULL, false }
};

static sl_cli_command_group_t escan_group = {
    { NULL },
    false,
    escan_command_table
};



static void cmd_get_data_handler(sl_cli_command_arg_t *arguments)
{
  uint8_t index = sl_cli_get_argument_uint8(arguments, 0);
  switch(index)
  {
    case POWER_DETECT:sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Power Detect:%d}\n", sli_mac_radio_energy_detection(sli_zigbee_get_current_network_index()));break;
    case POWER_LEVEL:sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Power Level:%d}\n", sli_mac_lower_mac_get_radio_power(sli_zigbee_get_current_network_index()));break;
    case CURRENT_CH :sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Current Channel:%d}\n", sli_mac_lower_mac_get_radio_channel(sli_zigbee_get_current_network_index()));break;
    case THRESHOLD :sl_iostream_printf(SL_IOSTREAM_STDOUT, "{Threshold:%d}\n", sli_mac_stack_get_ed_cca_threshold());break;
  }
}

static const sl_cli_command_info_t cmd_get_data_info = \
    SL_CLI_COMMAND(cmd_get_data_handler,
        "Get data",
        "Input index of data",
        {SL_CLI_ARG_UINT8OPT, SL_CLI_ARG_END, });

static sl_cli_command_entry_t get_data_command_table[] = {
    { "getdata", (sl_cli_command_info_t *)&cmd_get_data_info, false },
    { NULL, NULL, false }
};

static sl_cli_command_group_t get_data_group = {
    { NULL },
    false,
    get_data_command_table
};

static void cmd_set_data_handler(sl_cli_command_arg_t *arguments)
{
  uint8_t index = sl_cli_get_argument_uint8(arguments, 0);
  int32_t value = sl_cli_get_argument_int32(arguments, 1);
  sl_iostream_printf(SL_IOSTREAM_STDOUT, "Set data %d : %ld\n", index, value);
  switch(index)
  {
     case POWER_DETECT:sl_iostream_printf(SL_IOSTREAM_STDOUT, "Can't set\r\n");break;
     case POWER_LEVEL:if(value <= 20 && value >= 0)sli_mac_lower_mac_set_radio_power(sli_zigbee_get_current_network_index(),value);else sl_iostream_printf(SL_IOSTREAM_STDOUT, "Error \n");break;
     case CURRENT_CH:if(value <= 26 && value >= 11)sli_mac_lower_mac_set_radio_channel(sli_zigbee_get_current_network_index(),value);else sl_iostream_printf(SL_IOSTREAM_STDOUT, "Error \n");break;
     case THRESHOLD :if(value <= -45 && value >= -85)sli_mac_stack_set_cca_threshold(value);else sl_iostream_printf(SL_IOSTREAM_STDOUT, "Error \n");;break;
  }
}

static const sl_cli_command_info_t cmd_set_data_info = \
    SL_CLI_COMMAND(cmd_set_data_handler,
        "Set data",
        "Input index of data"SL_CLI_UNIT_SEPARATOR"Data",
        {SL_CLI_ARG_UINT8, SL_CLI_ARG_INT32, SL_CLI_ARG_END, });

static sl_cli_command_entry_t set_data_command_table[] = {
    { "setdata", (sl_cli_command_info_t *)&cmd_set_data_info, false },
    { NULL, NULL, false }
};

static sl_cli_command_group_t set_data_group = {
    { NULL },
    false,
    set_data_command_table
};



void init_custom_cli_commands(void) {


  for (uint32_t i = 0; i < sl_cli_handles_count; i++) {
      sl_cli_handle_t handle = sl_cli_handles[i];
      sl_cli_command_add_command_group(handle, &escan_group);
      sl_cli_command_add_command_group(handle, &get_data_group);
      sl_cli_command_add_command_group(handle, &set_data_group);
  }
}


#endif /* ADD_H_ */
